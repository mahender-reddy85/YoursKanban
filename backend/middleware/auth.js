const admin = require('../lib/firebaseAdmin');

/**
 * Middleware to protect routes with Firebase Authentication
 * Verifies the Firebase ID token from the Authorization header
 */
exports.protect = async (req, res, next) => {
  try {
    // Check for token in Authorization header
    const authHeader = req.headers.authorization || '';
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      console.error('No token found in Authorization header');
      return res.status(401).json({ 

      // Verify the ID token
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Get the user's record to ensure they exist
      const userRecord = await admin.auth().getUser(decodedToken.uid);
      
      // Attach user information to the request
      req.user = {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        customClaims: userRecord.customClaims || {}
      };
      
      console.log(`Authenticated user: ${req.user.email} (${req.user.uid})`);
      return next();
    } catch (error) {
      console.error('Token verification error:', error);
      
      // Handle different types of errors
      if (error.code === 'auth/id-token-expired') {
        return res.status(401).json({ 
          success: false,
          message: 'Token has expired. Please log in again.',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      if (error.code === 'auth/argument-error') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token format',
          code: 'INVALID_TOKEN_FORMAT'
        });
      }
      
      return res.status(401).json({
        success: false,
        message: 'Not authorized',
        code: 'AUTH_ERROR',
        error: error.message
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_FAILED'
    });
  }
};

/**
 * Middleware to check if user is an admin
 */
exports.admin = async (req, res, next) => {
  try {
    // First verify the token
    await exports.protect(req, res, async () => {
      try {
        // Check if user has admin claim
        const user = await admin.auth().getUser(req.user.uid);
        
        if (user.customClaims && user.customClaims.admin === true) {
          req.user.isAdmin = true;
          return next();
        }
        
        res.status(403).json({ 
          success: false,
          message: 'Not authorized as an admin',
          code: 'ADMIN_REQUIRED'
        });
      } catch (error) {
        console.error('Admin verification error:', error);
        res.status(500).json({
          success: false,
          message: 'Error verifying admin status',
          code: 'ADMIN_VERIFICATION_ERROR'
        });
      }
    });
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during admin verification',
      code: 'SERVER_ERROR'
    });
  }
};
