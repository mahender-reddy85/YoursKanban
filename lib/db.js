import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

// Database connection configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL,
  // Only enable SSL in production
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
};

// Create a new pool using the configuration
const pool = new Pool(dbConfig);

// Log database connection status
console.log('Attempting to connect to database...');
console.log('Database host:', process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'Not set');

// Test the database connection
const testConnection = async () => {
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Successfully connected to the database');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Connection string:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    
    // Log more detailed error information
    if (error.code === 'ECONNREFUSED') {
      console.error('Connection was refused. Please check:');
      console.error('1. Is the database server running?');
      console.error('2. Are the database credentials correct?');
      console.error('3. Is the database host accessible from this network?');
    }
    
    // Don't exit in production to allow for auto-recovery
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  }
};

// Test the connection immediately
testConnection();

// Test the connection every 5 minutes
setInterval(testConnection, 5 * 60 * 1000);

// Handle application shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing database connections...');
  pool.end();
  process.exit(0);
});

export default {
  query: (text, params) => {
    console.log('Executing query:', text.substring(0, 150) + (text.length > 150 ? '...' : ''));
    return pool.query(text, params);
  },
  pool
};
