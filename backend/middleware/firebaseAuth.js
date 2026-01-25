const { getAuth } = require('../lib/firebaseAdmin');

/**
 * Firebase Authentication Middleware
 * Verifies the Firebase ID token from the Authorization header
 * and attaches the decoded token to req.user
 */
const firebaseAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        message: 'No authentication token provided' 
      });
    }

    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        success: false, 
        message: 'No authentication token provided' 
      });
    }

    // Verify the ID token
    const decodedToken = await getAuth().verifyIdToken(token);
    
    // Check if token is expired
    const currentTime = Math.floor(Date.now() / 1000);
    if (decodedToken.exp < currentTime) {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication token has expired' 
      });
    }

    // Add the decoded token to the request object
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      email_verified: decodedToken.email_verified,
      name: decodedToken.name || '',
      picture: decodedToken.picture || ''
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        success: false, 
        message: 'Authentication token has expired' 
      });
    }
    
    if (error.code === 'auth/argument-error') {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid authentication token' 
      });
    }

    res.status(401).json({ 
      success: false, 
      message: 'Authentication failed' 
    });
  }
};

module.exports = firebaseAuth;
