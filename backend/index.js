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

// Import API routes and middleware
const meHandler = require('./api/me');
const tasksHandler = require('./api/tasks');
const firebaseAuth = require('./middleware/firebaseAuth');

// Initialize express app
const app = express();
const PORT = process.env.PORT || 3000;

// Apply CORS middleware with improved origin handling
const corsOptions = {
  origin: function(origin, callback) {
    // Allow all origins in development and for testing
    if (process.env.NODE_ENV !== 'production' || process.env.NODE_ENV === 'test') {
      console.log(`Allowing origin in ${process.env.NODE_ENV || 'development'} mode:`, origin);
      return callback(null, true);
    }

    // Allow all Vercel preview and production domains
    const allowedOrigins = [
      /^https?:\/\/yourskanban(-[a-z0-9]+)?\.vercel\.app$/,
      /^https?:\/\/yourskanban\.vercel\.app$/,
      /^https?:\/\/localhost(:[0-9]+)?$/,
      /^https?:\/\/.*\.vercel\.app$/,
      /^https?:\/\/.*yourskanban.*\.vercel\.app$/,
      /^https?:\/\/.*-likki-mahender-reddys-projects\.vercel\.app$/
    ];

    // Check if the origin matches any of the allowed patterns
    if (!origin || allowedOrigins.some(pattern => pattern.test(origin))) {
      return callback(null, true);
    }

    console.log('CORS blocked for origin:', origin);
    console.log('Allowed origins pattern:', allowedOrigins.map(p => p.toString()));
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Content-Length', 'Accept'],
  exposedHeaders: ['Set-Cookie'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  optionsSuccessStatus: 204,
  maxAge: 600 // 10 minutes for preflight cache
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors());

// Add CORS headers to all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Set CORS headers
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
  }
  
  next();
});

// Parse JSON bodies
app.use(express.json());

// Database connection and initialization
const { initializeDatabase } = require('./lib/db-init');

// Create database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Make pool available in request objects
app.use((req, res, next) => {
  req.db = pool;
  next();
});

// Initialize database and start server
let server;

async function startServer() {
  try {
    // Test database connection
    try {
      await pool.query('SELECT NOW()');
      console.log('✅ Database connection successful');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }

    // Initialize database schema
    console.log('Initializing database...');
    try {
      await initializeDatabase(pool);
      console.log('✅ Database schema initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
    
    // Start the server
    server = app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Set up error handlers after server starts successfully
      setupErrorHandlers(server);
    });
    
    // Handle server errors
    server.on('error', (error) => {
      if (error.syscall !== 'listen') {
        throw error;
      }

      // Handle specific listen errors with friendly messages
      switch (error.code) {
        case 'EACCES':
          console.error(`Port ${PORT} requires elevated privileges`);
          process.exit(1);
        case 'EADDRINUSE':
          console.error(`Port ${PORT} is already in use`);
          process.exit(1);
        default:
          throw error;
      }
    });
    
    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Set up error handlers
function setupErrorHandlers(server) {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled Rejection:', err);
    if (server) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    if (server) {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully');
    if (server) {
      server.close(() => {
        console.log('Process terminated');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
}

// Other middleware
app.use(helmet());
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

// User profile endpoints (protected by Firebase Auth)
app.get('/api/me', firebaseAuth, meHandler);

// Task routes (protected by Firebase Auth)
app.use('/api/tasks', firebaseAuth, tasksHandler);

// 404 handler
app.use((req, res) => {
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

// Start the server and handle any startup errors
startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

module.exports = { app, server };
