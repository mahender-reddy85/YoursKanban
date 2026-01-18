const { Pool } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

async function migrate() {
  // Load environment variables
  require('dotenv').config();
  
  // Create a new pool with a connection string that points to the postgres database
  // This is necessary because we need to create the application database if it doesn't exist
  const adminPool = new Pool({
    connectionString: process.env.DATABASE_URL.replace(/\/\w+$/, '/postgres'),
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await adminPool.connect();
  
  try {
    // Begin transaction
    await client.query('BEGIN');
    
    console.log('Starting database migration...');
    
    // Create the database if it doesn't exist
    const dbName = process.env.DATABASE_URL.split('/').pop().split('?')[0];
    console.log(`Ensuring database ${dbName} exists...`);
    
    try {
      await client.query(`CREATE DATABASE ${dbName}`);
      console.log(`Created database ${dbName}`);
    } catch (err) {
      if (err.code === '42P04') { // Database already exists
        console.log(`Database ${dbName} already exists`);
      } else {
        throw err;
      }
    }
    
    // Commit the transaction for creating the database
    await client.query('COMMIT');
    
    // Now connect to the application database
    await client.release();
    const appPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const appClient = await appPool.connect();
    
    try {
      await appClient.query('BEGIN');
      
      // Create users table
      console.log('Creating users table...');
      await appClient.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Create tasks table
      console.log('Creating tasks table...');
      await appClient.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(255) NOT NULL,
          description TEXT,
          status VARCHAR(50) NOT NULL CHECK (status IN ('todo', 'progress', 'done')),
          priority VARCHAR(50) NOT NULL CHECK (priority IN ('low', 'medium', 'high')),
          due_date TIMESTAMP WITH TIME ZONE,
          order_index INTEGER NOT NULL DEFAULT 0,
          is_pinned BOOLEAN NOT NULL DEFAULT false,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Create index on user_id for faster lookups
      await appClient.query(`
        CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
      `);
      
      // Create subtasks table
      console.log('Creating subtasks table...');
      await appClient.query(`
        CREATE TABLE IF NOT EXISTS subtasks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          text TEXT NOT NULL,
          is_done BOOLEAN NOT NULL DEFAULT false,
          order_index INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Create activity_logs table
      console.log('Creating activity_logs table...');
      await appClient.query(`
        CREATE TABLE IF NOT EXISTS activity_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
          action VARCHAR(100) NOT NULL,
          meta JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Create indexes for performance
      await appClient.query(`
        CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
        CREATE INDEX IF NOT EXISTS idx_subtasks_user_id ON subtasks(user_id);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_activity_logs_task_id ON activity_logs(task_id);
      `);
      
      // Create function to update updated_at timestamp
      console.log('Creating update_timestamp function...');
      await appClient.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
      `);
      
      // Create triggers for updated_at
      await appClient.query(`
        DROP TRIGGER IF EXISTS update_tasks_updated_at ON tasks;
        CREATE TRIGGER update_tasks_updated_at
        BEFORE UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        
        DROP TRIGGER IF EXISTS update_subtasks_updated_at ON subtasks;
        CREATE TRIGGER update_subtasks_updated_at
        BEFORE UPDATE ON subtasks
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
      `);
      
      await appClient.query('COMMIT');
      console.log('Database migration completed successfully!');
    } catch (err) {
      await appClient.query('ROLLBACK');
      console.error('Error during migration:', err);
      throw err;
    } finally {
      await appClient.release();
      await appPool.end();
    }
  } catch (err) {
    console.error('Error during database setup:', err);
    throw err;
  } finally {
    await client.release();
    await adminPool.end();
  }
}

// If this file is run directly, execute the migration
if (require.main === module) {
  migrate().catch(console.error);
}

module.exports = { migrate };
