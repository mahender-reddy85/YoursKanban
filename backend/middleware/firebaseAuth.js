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

      // Look up user in database to get integer ID
      const pool = req.db;
      let userResult;
      
      try {
        // Try to lookup by firebase_uid first (preferred)
        userResult = await pool.query(
          'SELECT id, email FROM users WHERE firebase_uid = $1 LIMIT 1',
          [decodedToken.uid]
        );
      } catch (error) {
        // If firebase_uid column doesn't exist, fall back to email lookup
        userResult = await pool.query(
          'SELECT id, email FROM users WHERE email = $1 LIMIT 1',
          [decodedToken.email]
        );
      }

      let dbUser = userResult.rows[0];
      
      // If user not found, create them
      if (!dbUser) {
        const createResult = await pool.query(
          `INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())
           RETURNING id, email`,
          [decodedToken.uid, decodedToken.email, decodedToken.name || decodedToken.email.split('@')[0]]
        );
        dbUser = createResult.rows[0];
      }

      // Attach user info to request with database integer ID
      req.user = {
        id: dbUser.id,           // Database integer ID
        uid: decodedToken.uid,   // Firebase UID (for reference)
        email: dbUser.email,
        emailVerified: decodedToken.email_verified || false,
        isGuest: false
      };
      
      return next();
  } catch (tokenError) {

    
    if (tokenError.code === 'auth/id-token-expired') {
      throw new AppError('Token expired', 401, errorTypes.TOKEN_EXPIRED);
    }
    
    // For other token errors, continue as guest
    req.user = { isGuest: true };
    return next();
  }
});

module.exports = firebaseAuth;
