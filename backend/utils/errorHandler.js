/**
 * Standardized error handling for the application
 */

class AppError extends Error {
  constructor(message, statusCode, code) {
    super(message);
    this.statusCode = statusCode;
    this.code = code || 'APP_ERROR';
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
const errorTypes = {
  // Authentication errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Not found errors (404)
  NOT_FOUND: 'NOT_FOUND',
  
  // Forbidden errors (403)
  FORBIDDEN: 'FORBIDDEN',
  
  // Conflict errors (409)
  CONFLICT: 'CONFLICT',
  
  // Server errors (500)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR'
};

// Error response formatter
const sendErrorResponse = (res, error) => {
  // Default to 500 if status code is not set
  const statusCode = error.statusCode || 500;
  
  // Don't leak error details in production for non-operational errors
  const errorResponse = {
    success: false,
    message: error.message || 'An unexpected error occurred',
    code: error.code || 'INTERNAL_SERVER_ERROR',
    ...(process.env.NODE_ENV === 'development' && {
      stack: error.stack,
      ...(error.errors && { errors: error.errors })
    })
  };

  res.status(statusCode).json(errorResponse);
};

// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  console.error('Global error handler:', err);
  
  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    err = new AppError('Invalid token', 401, 'INVALID_TOKEN');
  } else if (err.name === 'TokenExpiredError') {
    err = new AppError('Token expired', 401, 'TOKEN_EXPIRED');
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map(el => el.message);
    err = new AppError(`Invalid input: ${errors.join('. ')}`, 400, 'VALIDATION_ERROR');
  }
  
  // Handle duplicate field errors
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    err = new AppError(`${field} already in use`, 400, 'DUPLICATE_FIELD');
  }
  
  // Handle cast errors (invalid ID format, etc.)
  if (err.name === 'CastError') {
    const message = `Invalid ${err.path}: ${err.value}`;
    err = new AppError(message, 400, 'INVALID_INPUT');
  }

  sendErrorResponse(res, err);
};

// 404 handler
const notFoundHandler = (req, res) => {
  const error = new AppError(`Can't find ${req.originalUrl} on this server!`, 404, 'NOT_FOUND');
  sendErrorResponse(res, error);
};

// Wrapper for async/await error handling
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch((err) => {
    console.error('Async error caught:', err);
    next(err);
  });
};

module.exports = {
  AppError,
  errorTypes,
  globalErrorHandler,
  notFoundHandler,
  catchAsync,
  sendErrorResponse
};
