const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initializeDatabase(pool) {
  console.log('Initializing database with safe SQL...');

  // Function (safe to run many times)
  await pool.query(`
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  // Trigger (safe check)
  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'update_tasks_updated_at'
      ) THEN
        CREATE TRIGGER update_tasks_updated_at
        BEFORE UPDATE ON tasks
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
      END IF;
    END;
    $$;
  `);

  console.log('✅ Database initialized successfully with safe SQL');
}

// Run the initialization if this file is called directly
if (require.main === module) {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  initializeDatabase(pool).catch(console.error).finally(() => pool.end());
}

module.exports = { initializeDatabase };
