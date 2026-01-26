const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const migrationPath = path.join(__dirname, 'database', 'migrations', '0003_add_guest_support.sql');
    const sql = await fs.readFile(migrationPath, 'utf8');
    
    console.log('Running migration...');
    await pool.query(sql);
    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
