const admin = require('../lib/firebaseAdmin');
const { pool } = require('../lib/db');

/**
 * Firebase Authentication Middleware
 * Verifies the Firebase ID token from the Authorization header
 * and attaches the decoded token to req.user
 */
const firebaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'No authentication token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No authentication token provided' 
      });
    }

    // Verify the ID token using admin.auth()
    console.log('🔍 Verifying token...');
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token, true); // true to check if token is revoked
      console.log('✅ Token verified successfully');
      
      // Check if token is expired
      const currentTime = Math.floor(Date.now() / 1000);
      if (decodedToken.exp < currentTime) {
        return res.status(401).json({ 
          success: false, 
          message: 'Authentication token has expired' 
        });
      }

      // Get user info from token
      const firebaseUid = decodedToken.uid;
      const email = decodedToken.email || null;
      
      // Check if user exists in our database
      let result = await pool.query(
        "SELECT * FROM users WHERE firebase_uid = $1",
        [firebaseUid]
      );

      let user;

      if (result.rows.length === 0) {
        // Create user automatically if they don't exist
        console.log(" Creating new user:", { firebaseUid, email });
        const insert = await pool.query(
          "INSERT INTO users (firebase_uid, email) VALUES ($1, $2) RETURNING *",
          [firebaseUid, email]
        );
        user = insert.rows[0];
        console.log(" New user created:", user.id);
      } else {
        // Use existing user
        user = result.rows[0];
      }
      
      // Attach user to request object and continue
      req.user = user;
      next();
    } catch (verifyError) {
      console.error('❌ Token verification failed:', {
        message: verifyError.message,
        code: verifyError.code,
        errorInfo: verifyError.errorInfo
      });
      throw verifyError; // Re-throw to be caught by our main error handler
    }
  } catch (error) {
    console.error(' Authentication error:', {
      message: error.message,
      code: error.code,
      stack: error.stack,
      headers: req.headers,
      tokenPresent: !!req.headers.authorization,
      url: req.originalUrl
    });
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.code === 'auth/argument-error') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid authentication token',
        code: 'INVALID_TOKEN'
      });
    }

    // More specific error handling for common Firebase Auth errors
    if (error.code === 'auth/invalid-credential') {
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }

    if (error.code === 'auth/user-disabled') {
      return res.status(403).json({
        success: false,
        message: 'This account has been disabled',
        code: 'ACCOUNT_DISABLED'
      });
    }

    // For development, include more error details
    const errorResponse = {
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_FAILED'
    };

    // In development, include more details
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = {
        error: error.message,
        code: error.code
      };
    }

    res.status(401).json(errorResponse);
  }
};

module.exports = firebaseAuth;
