import { comparePasswords, generateToken } from '../../lib/auth.js';
import db from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Please provide email and password' });
    }

    // Get user from database
    const result = await db.query(
      'SELECT id, name, email, password_hash FROM users WHERE email = $1',
      [email]
    );

    const user = result.rows[0];

    if (!user || !(await comparePasswords(password, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    // Generate token
    const token = generateToken(user.id);

    // Set HTTP-only cookie with token
    res.setHeader(
      'Set-Cookie',
      `token=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800` // 7 days
    );

    return res.status(200).json({
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}
