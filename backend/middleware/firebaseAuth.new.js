const admin = require("../config/firebase");

/**
 * Middleware to authenticate requests using Firebase ID tokens
 * Handles both authenticated and unauthenticated (guest) access
 */
module.exports = async function firebaseAuth(req, res, next) {
  try {
    // Skip authentication for OPTIONS requests
    if (req.method === 'OPTIONS') {
      return next();
    }

    // Allow unauthenticated access to public endpoints
    const publicPaths = ['/api/health', '/api/version'];
    if (publicPaths.includes(req.path)) {
      return next();
    }

    // Check for authorization header
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      // No token provided, continue as guest
      req.user = { isGuest: true };
      return next();
    }

    // Verify Firebase token
    const token = header.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      if (!decodedToken.uid) {
        throw new Error('Invalid token: No UID found');
      }

      // Attach user info to request
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified || false,
        isGuest: false
      };
      
      return next();
    } catch (tokenError) {
      console.error('Token verification failed:', tokenError);
      
      if (tokenError.code === 'auth/id-token-expired') {
        return res.status(401).json({ 
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      // For other token errors, continue as guest
      req.user = { isGuest: true };
      return next();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    
    // For unexpected errors, continue as guest
    req.user = { isGuest: true };
    return next();
  }
};
