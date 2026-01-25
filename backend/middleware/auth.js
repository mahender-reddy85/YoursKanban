import admin from '../lib/firebaseAdmin.js';

// Log project initialization
console.log('Firebase Admin initialized with project:', admin.app().options.projectId);

/**
 * Middleware to verify Firebase ID token
 */
export const verifyFirebaseToken = async (req, res, next) => {
  try {
    // Log incoming request details
    console.log('\n--- New Request ---');
    console.log('Path:', req.path);
    console.log('Method:', req.method);
    console.log('Headers:', {
      host: req.headers.host,
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    });

    // Skip token verification for OPTIONS requests (preflight)
    if (req.method === 'OPTIONS') {
      console.log('Skipping auth for OPTIONS request');
      return next();
    }

    const header = req.headers.authorization;

    if (!header) {
      console.log('No Authorization header found');
      return res.status(401).json({ 
        success: false,
        code: 'MISSING_AUTH_HEADER',
        message: 'No authorization header provided',
        timestamp: new Date().toISOString()
      });
    }

    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      console.log('Invalid Authorization header format');
      return res.status(401).json({ 
        success: false,
        code: 'INVALID_AUTH_HEADER',
        message: 'Authorization header must be: Bearer <token>',
        timestamp: new Date().toISOString()
      });
    }

    const token = parts[1];
    console.log('Token received (first 10 chars):', token.substring(0, 10) + '...');
    
    try {
      // Verify the token
      const decodedToken = await admin.auth().verifyIdToken(token);
      console.log('Token verified for user:', decodedToken.uid);
      
      // Add the decoded token to the request
      req.user = decodedToken;
      return next();
      
    } catch (error) {
      console.error('Token verification failed:', error.message);
      
      let statusCode = 401;
      let errorCode = 'INVALID_TOKEN';
      let message = 'Invalid or expired token';

      if (error.code === 'auth/id-token-expired') {
        errorCode = 'TOKEN_EXPIRED';
        message = 'Token has expired';
      } else if (error.code === 'auth/user-disabled') {
        errorCode = 'USER_DISABLED';
        message = 'This account has been disabled';
        statusCode = 403;
      } else if (error.code === 'auth/argument-error') {
        errorCode = 'INVALID_TOKEN_FORMAT';
        message = 'Invalid token format';
      }

      return res.status(statusCode).json({
        success: false,
        code: errorCode,
        message: message,
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('Unexpected error in auth middleware:', error);
    return res.status(500).json({
      success: false,
      code: 'SERVER_ERROR',
      message: 'An unexpected error occurred',
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * Middleware to check if user is an admin
 */
export const requireAdmin = async (req, res, next) => {
  try {
    // First verify the token
    await verifyFirebaseToken(req, res, async () => {
      try {
        // Get the full user record to check admin status
        const userRecord = await admin.auth().getUser(req.user.uid);
        
        if (userRecord.customClaims && userRecord.customClaims.admin === true) {
          req.user.isAdmin = true;
          return next();
        }
        
        console.warn('Admin access denied for user:', req.user.uid);
        return res.status(403).json({ 
          success: false,
          code: 'ADMIN_REQUIRED',
          message: 'Admin access required',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('Admin verification error:', error);
        return res.status(500).json({
          success: false,
          code: 'ADMIN_VERIFICATION_ERROR',
          message: 'Error verifying admin status',
          timestamp: new Date().toISOString()
        });
      }
    });
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ 
      success: false,
      code: 'SERVER_ERROR',
      message: 'Server error during admin verification',
      timestamp: new Date().toISOString()
    });
  }
};
