const { protect } = require('../lib/auth');

module.exports = async (req, res) => {
  // Add protect middleware
  await new Promise((resolve, reject) => {
    protect(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      resolve(result);
    });
  });

  try {
    // If we get here, the user is authenticated
    // Remove sensitive data before sending
    const { password_hash, ...userWithoutPassword } = req.user;
    
    res.status(200).json({
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Server error while fetching user data' });
  }
};

// Add a property to indicate this route requires authentication
module.exports.config = {
  requiresAuth: true
};
