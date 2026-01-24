const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Initializing database with safe SQL...');
    
    // Add user_id column safely
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name='tasks' AND column_name='user_id'
        ) THEN
          ALTER TABLE tasks ADD COLUMN user_id TEXT;
        END IF;
      END $$;
    `);

    // Create index safely
    await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)');

    // 1. Create or replace the update function
    await pool.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $func$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $func$ LANGUAGE plpgsql;
    `);

    // 2. Create trigger safely using DO block
    await pool.query(`
      DO $block$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger 
          WHERE tgname = 'update_tasks_updated_at'
        ) THEN
          CREATE TRIGGER update_tasks_updated_at
          BEFORE UPDATE ON tasks
          FOR EACH ROW
          EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END
      $block$;
    `);
    
    console.log('✅ Database initialized successfully with safe SQL');
    
    // Verify the tables exist
    const { rows } = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    console.log('Tables in database:', rows.map(r => r.table_name).join(', '));
    
  } catch (error) {
    console.error('❌ Error initializing database:');
    console.error(error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run the initialization if this file is called directly
if (require.main === module) {
  initializeDatabase().catch(console.error);
}

module.exports = { initializeDatabase };
