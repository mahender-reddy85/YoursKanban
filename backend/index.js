require('dotenv').config();

// Debug environment variables
console.log("DATABASE_URL exists?", !!process.env.DATABASE_URL);
console.log("DATABASE_URL preview:", process.env.DATABASE_URL?.slice(0, 30));

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { createServer } = require('http');
const { Pool } = require('pg');

// Import API routes
const registerHandler = require('./api/register');
const loginHandler = require('./api/login');
const meHandler = require('./api/me');
const tasksHandler = require('./api/tasks');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Test database connection with detailed logging
console.log('Testing database connection...');
console.log('Database host:', process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'Not set');

// Test the connection
pool.query('SELECT NOW()')
  .then(() => {
    console.log('✅ Successfully connected to the database');
  })
  .catch(err => {
    console.error('❌ Database connection failed:');
    console.error('Error code:', err.code);
    console.error('Error message:', err.message);
    console.error('Connection string:', process.env.DATABASE_URL ? 
      process.env.DATABASE_URL.replace(/:([^:]+)@/, ':***@') : 'Not set');
  });

// Add database to request object
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Configure CORS with more options
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      'https://yourskanban.vercel.app',
      'http://localhost:3000',
      'http://localhost:3001'
    ];
    
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Add db to request object
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Other middleware
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint with database connectivity check
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await pool.query('SELECT NOW()');
    
    // Check if tables exist
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      database: 'connected',
      tables: tables.rows.map(row => row.table_name)
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// API Routes
app.use('/api/auth/register', registerHandler);
app.use('/api/auth/login', loginHandler);
app.use('/api/auth/me', meHandler);

// Task routes
app.use('/api/tasks', tasksHandler);

// 404 handler
app.use((req, res, next) => {
  res.status(404).json({ message: 'Not Found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message
  });
});

// Create HTTP server
const server = createServer(app);

// Start server
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  server.close(() => process.exit(1));
});

// Handle SIGTERM
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = { app, server };
