const admin = require('../lib/firebaseAdmin');

/**
 * Middleware to protect routes with Firebase Authentication
 * Verifies the Firebase ID token from the Authorization header
 */
exports.protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const idToken = header.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken);

    // Attach minimal user info to the request
    req.user = { 
      id: decoded.uid,
      email: decoded.email,
      email_verified: decoded.email_verified || false
    };
    
    next();
  } catch (err) {
    console.error('Authentication error:', err);
    return res.status(401).json({ 
      message: "Invalid or expired token",
      code: "AUTH_ERROR"
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
        // Get the full user record to check admin status
        const userRecord = await admin.auth().getUser(req.user.id);
        
        if (userRecord.customClaims && userRecord.customClaims.admin === true) {
          req.user.isAdmin = true;
          return next();
        }
        
        return res.status(403).json({ 
          success: false,
          message: 'Admin access required',
          code: 'ADMIN_REQUIRED'
        });
      } catch (error) {
        console.error('Admin verification error:', error);
        return res.status(500).json({
          success: false,
          message: 'Error verifying admin status',
          code: 'ADMIN_VERIFICATION_ERROR'
        });
      }
    });
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'Server error during admin verification',
      code: 'SERVER_ERROR'
    });
  }
};
