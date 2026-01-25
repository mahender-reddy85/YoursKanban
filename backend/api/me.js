const { verifyToken } = require('../lib/auth');
const { Pool } = require('pg');

// Create a new pool using the connection string from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

module.exports = async (req, res) => {
  try {
    // Get the token from cookies
    const token = req.cookies?.token;
    
    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    // Verify the token
    const decoded = verifyToken(token);
    if (!decoded || !decoded.id) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    // Fetch the user from the database
    const result = await pool.query(
      'SELECT id, username, email, created_at, updated_at FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      // Clear the invalid token
      res.clearCookie('token');
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result.rows[0];
    res.status(200).json({ 
      user,
      message: 'User authenticated successfully' 
    });
  } catch (error) {
    console.error('Get user error:', error);
    // Clear the invalid token on error
    res.clearCookie('token');
    res.status(500).json({ 
      message: 'Server error while fetching user data',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};
