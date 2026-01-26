const admin = require("../config/firebase");
const { AppError, errorTypes, catchAsync } = require("../utils/errorHandler");

/**
 * Middleware to authenticate requests using Firebase ID tokens
 * Handles both authenticated and unauthenticated (guest) access
 */
const firebaseAuth = catchAsync(async (req, res, next) => {
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
      throw new AppError('Invalid authentication token', 401, errorTypes.INVALID_TOKEN);
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
      throw new AppError('Token expired', 401, errorTypes.TOKEN_EXPIRED);
    }
    
    // For other token errors, continue as guest
    req.user = { isGuest: true };
    return next();
  }
});

module.exports = firebaseAuth;
