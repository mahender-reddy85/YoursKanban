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
  ssl: {
    rejectUnauthorized: false
  }
});

// Test database connection with detailed logging
console.log('Testing database connection...');
console.log('Database host:', process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : 'Not set');

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

// Configure CORS
app.use(cors({
  origin: [
    "https://yourskanban.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001"
  ],
  credentials: true
}));

// Handle preflight requests
app.options("*", cors());

// Add db to request object
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Other middleware
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.post('/api/auth/register', registerHandler);
app.post('/api/auth/login', loginHandler);
app.get('/api/auth/me', meHandler);

// Task routes (protected)
app.all('/api/tasks*', (req, res, next) => {
  // Apply auth middleware to all /tasks* routes
  require('./lib/auth').protect(req, res, next);
}, tasksHandler);

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
