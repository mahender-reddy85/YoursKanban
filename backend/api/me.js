const { Pool } = require('pg');
const { getAuth } = require('../lib/firebase-admin');

// Create a new pool using the connection string from environment variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Get or create user in the database
 * @param {string} uid - Firebase UID
 * @param {string} email - User email
 * @param {string} [name] - User's display name
 * @returns {Promise<Object>} - User data
 */
async function getOrCreateUser(uid, email, name = '') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Try to get existing user
    const userResult = await client.query(
      'SELECT * FROM users WHERE firebase_uid = $1',
      [uid]
    );
    
    let user = userResult.rows[0];
    
    // If user doesn't exist, create a new one
    if (!user) {
      const newUserResult = await client.query(
        `INSERT INTO users (firebase_uid, email, name, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         RETURNING *`,
        [uid, email, name || email.split('@')[0]]
      );
      user = newUserResult.rows[0];
    }
    
    await client.query('COMMIT');
    return user;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error in getOrCreateUser:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = async (req, res) => {
  try {
    // Get the Firebase user from the request (set by firebaseAuth middleware)
    const firebaseUser = req.user;
    
    if (!firebaseUser || !firebaseUser.uid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Not authenticated' 
      });
    }
    
    // Get or create the user in our database
    const user = await getOrCreateUser(
      firebaseUser.uid,
      firebaseUser.email,
      firebaseUser.name || firebaseUser.displayName || ''
    );

    if (!user) {
      return res.status(500).json({ 
        success: false,
        message: 'Failed to create user' 
      });
    }
    
    // Return the user data
    res.status(200).json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        created_at: user.created_at,
        updated_at: user.updated_at
      },
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
