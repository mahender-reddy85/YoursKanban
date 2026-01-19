import { protect } from '../../lib/auth.js';
import db from '../../lib/db.js';

async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // This will be set by the protect middleware
    if (!req.userId) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    // Get user from database
    const result = await db.query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.userId]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('GET USER ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default protect(handler);
