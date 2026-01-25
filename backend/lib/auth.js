const admin = require('./firebase');

/**
 * Middleware to protect routes with Firebase Authentication
 * Verifies the Firebase ID token in the Authorization header
 * and attaches the decoded token to req.user
 */
const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    try {
      // Verify the Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(token);
      
      // Attach the decoded token to the request object
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        email_verified: decodedToken.email_verified,
        name: decodedToken.name,
        picture: decodedToken.picture
      };
      
      next();
    } catch (error) {
      console.error('Error verifying token:', error);
      return res.status(401).json({ 
        message: 'Invalid or expired token',
        error: error.message 
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ 
      message: 'Authentication failed',
      error: error.message 
    });
  }
};

module.exports = {
  protect
};
  hashPassword,
  comparePasswords,
  protect,
  JWT_SECRET
};

export default {
  generateToken,
  verifyToken,
  hashPassword,
  comparePasswords,
  protect,
  JWT_SECRET
};
