import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '../../database/migrations');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runMigrations() {
  const client = await pool.connect();
  
  try {
    // Create migrations table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        run_on TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Get all migration files
    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter(file => file.endsWith('.sql'))
      .sort();

    // Get already run migrations
    const { rows: completedMigrations } = await client.query('SELECT name FROM migrations');
    const completedMigrationNames = new Set(completedMigrations.map(m => m.name));

    // Run new migrations
    for (const file of files) {
      if (!completedMigrationNames.has(file)) {
        console.log(`Running migration: ${file}`);
        const migrationSQL = await fs.readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
        
        await client.query('BEGIN');
        try {
          await client.query(migrationSQL);
          await client.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
          await client.query('COMMIT');
          console.log(`✓ ${file} completed successfully`);
        } catch (error) {
          await client.query('ROLLBACK');
          console.error(`✗ Error running migration ${file}:`, error.message);
          throw error;
        }
      } else {
        console.log(`✓ ${file} already run, skipping`);
      }
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigrations();
