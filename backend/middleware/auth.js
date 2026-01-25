import admin from '../lib/firebaseAdmin.js';

console.log("Admin project:", admin.app().options.projectId);

/**
 * Middleware to verify Firebase ID token
 */
export const verifyFirebaseToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) {
    console.error('No authorization header');
    return res.status(401).json({ 
      success: false,
      code: 'MISSING_AUTH_HEADER',
      message: 'No authorization header provided'
    });
  }

  const token = header.split(' ')[1];
  if (!token) {
    console.error('No token provided');
    return res.status(401).json({ 
      success: false,
      code: 'NO_TOKEN',
      message: 'No authentication token provided'
    });
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log('Token project:', decoded.aud);
    console.log('Authenticated user:', { uid: decoded.uid, email: decoded.email });
    
    // Attach user info to the request
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      email_verified: decoded.email_verified || false
    };
    
    next();
  } catch (err) {
    console.error('Token verification failed:', err.message);
    
    // Handle specific error cases
    let errorCode = 'TOKEN_VERIFICATION_FAILED';
    let statusCode = 401;
    let message = 'Invalid or expired token';
    
    if (err.code === 'auth/id-token-expired') {
      errorCode = 'TOKEN_EXPIRED';
      message = 'Token has expired. Please log in again.';
    } else if (err.code === 'auth/argument-error') {
      errorCode = 'INVALID_TOKEN';
      message = 'Invalid token format';
    } else if (err.code === 'auth/user-disabled') {
      errorCode = 'USER_DISABLED';
      message = 'This account has been disabled';
      statusCode = 403;
    }
    
    return res.status(statusCode).json({
      success: false,
      code: errorCode,
      message: message
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
          message: 'Admin access required'
        });
      } catch (error) {
        console.error('Admin verification error:', error);
        return res.status(500).json({
          success: false,
          code: 'ADMIN_VERIFICATION_ERROR',
          message: 'Error verifying admin status'
        });
      }
    });
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ 
      success: false,
      code: 'SERVER_ERROR',
      message: 'Server error during admin verification'
    });
  }
};
