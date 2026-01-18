const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { query } = require('../db');

/**
 * Register a new user
 */
const register = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { name, email, password } = req.body;

    // Check if user already exists
    const userExists = await query('SELECT id FROM users WHERE email = $1', [email]);
    
    if (userExists.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const newUser = await query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name, email, hashedPassword]
    );

    // Generate JWT token
    const token = jwt.sign(
      { userId: newUser.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Log activity
    await logActivity(newUser.rows[0].id, null, 'user_registered');

    res.status(201).json({
      success: true,
      data: {
        user: newUser.rows[0],
        token
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during registration'
    });
  }
};

/**
 * Login user
 */
const login = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Check if user exists
    const userResult = await query('SELECT * FROM users WHERE email = $1', [email]);
    
    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    const user = userResult.rows[0];

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password_hash);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // Remove password hash from response
    const { password_hash, ...userData } = user;

    // Log activity
    await logActivity(user.id, null, 'user_logged_in');

    res.json({
      success: true,
      data: {
        user: userData,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
};

/**
 * Get current user profile
 */
const getMe = async (req, res) => {
  try {
    const userResult = await query(
      'SELECT id, name, email, created_at FROM users WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: userResult.rows[0]
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching profile'
    });
  }
};

/**
 * Log activity
 * @private
 */
async function logActivity(userId, taskId, action, meta = {}) {
  try {
    await query(
      'INSERT INTO activity_logs (user_id, task_id, action, meta) VALUES ($1, $2, $3, $4)',
      [userId, taskId, action, meta]
    );
  } catch (error) {
    console.error('Error logging activity:', error);
  }
}

module.exports = {
  register,
  login,
  getMe
};
