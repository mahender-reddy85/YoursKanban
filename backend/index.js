require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { query } = require('./db');
const { authenticateJWT } = require('./middleware/auth');

// Import controllers
const authController = require('./auth/auth.controller');
const tasksController = require('./tasks/tasks.controller');

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Test database connection
    await query('SELECT NOW()');
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({ 
      status: 'error',
      message: 'Database connection failed',
      error: error.message 
    });
  }
});

// Auth routes
app.post('/api/register', [
  // Validation middleware would go here
], authController.register);

app.post('/api/login', [
  // Validation middleware would go here
], authController.login);

// Protected routes (require authentication)
app.use(authenticateJWT);

// User routes
app.get('/api/me', authController.getMe);

// Task routes
app.get('/api/tasks', tasksController.getTasks);
app.get('/api/tasks/:id', tasksController.getTask);
app.post('/api/tasks', tasksController.createTask);
app.put('/api/tasks/:id', tasksController.updateTask);
app.delete('/api/tasks/:id', tasksController.deleteTask);
app.post('/api/tasks/reorder', tasksController.reorderTasks);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: 'The authentication token is invalid'
    });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Token expired',
      message: 'The authentication token has expired'
    });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError' || err.name === 'BadRequestError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      message: err.message,
      details: err.details
    });
  }
  
  // Handle other errors
  res.status(err.status || 500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

module.exports = app;
