import admin from '../lib/firebaseAdmin.js';

// Log project initialization
console.log('Firebase Admin initialized with project:', admin.app().options.projectId);

/**
 * Middleware to verify Firebase ID token
 */
export const verifyFirebaseToken = async (req, res, next) => {
  // Log incoming request details
  console.log('\n--- New Request ---');
  console.log('Path:', req.path);
  console.log('Method:', req.method);
  console.log('Headers:', {
    host: req.headers.host,
    'content-type': req.headers['content-type'],
    'user-agent': req.headers['user-agent']
  });

  const header = req.headers.authorization;

  if (!header) {
    console.log(' No Authorization header found');
    return res.status(401).json({ 
      success: false,
      code: 'MISSING_AUTH_HEADER',
      message: 'No authorization header provided',
      timestamp: new Date().toISOString()
    });
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log(' Invalid Authorization header format');
    return res.status(401).json({ 
      success: false,
      code: 'INVALID_AUTH_HEADER',
      message: 'Authorization header must be: Bearer <token>',
      timestamp: new Date().toISOString()
    });
  }
  
  const token = parts[1];
  console.log(' Token received (first 30 chars):', token.substring(0, 30) + '...');
  console.log(' Token length:', token.length);
  console.log(' Token prefix:', token.split('.')[0]);

  try {
    console.log(' Verifying token...');
    const decoded = await admin.auth().verifyIdToken(token, true); // Check if token is revoked
    
    console.log(' Token verified successfully');
    console.log(' Decoded token:', {
      uid: decoded.uid,
      email: decoded.email,
      email_verified: decoded.email_verified,
      auth_time: decoded.auth_time ? new Date(decoded.auth_time * 1000).toISOString() : null,
      iat: decoded.iat ? new Date(decoded.iat * 1000).toISOString() : null,
      exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
      now: new Date().toISOString(),
      token_used: decoded.token_used || false,
      aud: decoded.aud,
      iss: decoded.iss,
      sub: decoded.sub,
      firebase: decoded.firebase ? {
        sign_in_provider: decoded.firebase.sign_in_provider,
        identities: Object.keys(decoded.firebase.identities || {})
      } : null
    });

    // Check if token is expired
    const now = Date.now() / 1000;
    if (decoded.exp < now) {
      console.error(' Token expired:', { 
        expired_seconds_ago: Math.round(now - decoded.exp),
        expired_at: new Date(decoded.exp * 1000).toISOString()
      });
      throw new Error('Token has expired');
    }

    // Verify the token's audience matches your project
    const projectId = admin.app().options.projectId;
    if (decoded.aud !== projectId) {
      console.error('Token audience does not match project ID');
      console.log('Token aud:', decoded.aud);
      console.log('Expected aud:', projectId);
      return res.status(401).json({
        success: false,
        code: 'INVALID_AUDIENCE',
        message: 'Invalid token audience',
        timestamp: new Date().toISOString()
      });
    }
    
    // Attach user info to the request
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      email_verified: decoded.email_verified || false
    };
    
    console.log('Authentication successful for user:', req.user.uid);
    next();
  } catch (error) {
    console.error('Token verification failed:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    // Handle specific error cases
    let statusCode = 401;
    let errorCode = 'INVALID_TOKEN';
    let message = 'Invalid or expired token';
    
    if (error.code === 'auth/id-token-expired') {
      errorCode = 'TOKEN_EXPIRED';
      message = 'Token has expired. Please log in again.';
    } else if (error.code === 'auth/argument-error') {
      errorCode = 'INVALID_TOKEN_FORMAT';
      message = 'Invalid token format';
    } else if (error.code === 'auth/user-disabled') {
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
