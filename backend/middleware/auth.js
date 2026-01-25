const admin = require('../lib/firebaseAdmin');

/**
 * Middleware to protect routes with Firebase Authentication
 * Verifies the Firebase ID token from the Authorization header
 */
exports.protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;

    // Check if Authorization header exists and is in the correct format
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    // Extract the token from the header
    const idToken = header.split("Bearer ")[1];

    if (!idToken) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Add the user ID to the request object
    req.user = { 
      id: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified
    };
    
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    // Handle different types of errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: "Token has expired. Please log in again." });
    }
    
    if (error.code === 'auth/argument-error') {
      return res.status(401).json({ message: "Invalid token format" });
    }
    
    return res.status(401).json({ 
      message: "Not authorized, token failed",
      error: error.message 
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
      // Check if user has admin claim
      const user = await admin.auth().getUser(req.user.id);
      
      if (user.customClaims && user.customClaims.admin === true) {
        req.user.isAdmin = true;
        return next();
      }
      
      res.status(403).json({ message: 'Not authorized as an admin' });
    });
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ message: 'Server error during admin verification' });
  }
};
