const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, '../../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    // Execute the schema
    await pool.query(schema);
    console.log('✅ Database schema initialized successfully');
    
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
