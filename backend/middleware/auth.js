const jwt = require('jsonwebtoken');
const { query } = require('../db');

/**
 * Middleware to authenticate JWT token
 */
const authenticateJWT = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication token is required' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication token is required' 
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user still exists
    const userResult = await query('SELECT id, name, email FROM users WHERE id = $1', [decoded.userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not found' 
      });
    }

    // Attach user to request object
    req.user = userResult.rows[0];
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Token has expired' 
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid token' 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      error: 'Authentication failed' 
    });
  }
};

/**
 * Middleware to check if user has required permissions
 * @param {Array} roles - Array of allowed roles
 */
const checkPermissions = (roles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }
    
    // For now, we'll just check if the user is authenticated
    // In the future, you can implement role-based access control here
    next();
  };
};

module.exports = {
  authenticateJWT,
  checkPermissions
};
