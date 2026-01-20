const { protect } = require('../lib/auth');

// Middleware to handle authentication
const withAuth = async (req, res, next) => {
  // For GET requests, allow unauthenticated access but try to set user if token exists
  if (req.method === 'GET') {
    if (req.headers.authorization) {
      // If there's a token, try to authenticate but don't fail if it's invalid
      return protect(req, res, () => next());
    }
    return next();
  }
  
  // For other methods, require authentication
  if (!req.headers.authorization) {
    return res.status(401).json({ message: 'Authentication required' });
  }
  
  // Verify token for authenticated requests
  return protect(req, res, (err) => {
    if (err) {
      console.error('Auth error:', err);
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
    
    // Ensure user is set on the request
    if (!req.user || !req.user.id) {
      console.error('No user ID found in request');
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    next();
  });
};

// Get all tasks (works for both authenticated and unauthenticated users)
const getTasks = async (req, res) => {
  try {
    console.log('getTasks called, user:', req.user ? 'authenticated' : 'unauthenticated');
    
    if (!req.user) {
      // For unauthenticated users, return an empty array
      console.log('Returning empty array for unauthenticated user');
      return res.status(200).json([]);
    }
    
    try {
      console.log('Querying tasks for user:', req.user.id);
      const { rows } = await req.db.query(
        'SELECT * FROM tasks WHERE user_id = $1 ORDER BY order_index, created_at DESC',
        [req.user.id]
      );
      console.log(`Found ${rows.length} tasks for user ${req.user.id}`);
      return res.status(200).json(rows);
    } catch (dbError) {
      console.error('Database query error in getTasks:', {
        error: dbError.message,
        query: 'SELECT * FROM tasks WHERE user_id = $1',
        userId: req.user.id,
        stack: dbError.stack
      });
      return res.status(500).json({ 
        message: 'Database error while fetching tasks',
        error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
      });
    }
  } catch (error) {
    console.error('Unexpected error in getTasks:', {
      error: error.message,
      stack: error.stack,
      user: req.user || 'no user'
    });
    res.status(500).json({ 
      message: 'Internal server error while fetching tasks',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// Create a new task
const createTask = async (req, res) => {
  try {
    const { title, description, status, priority, due_date, order_index, is_pinned } = req.body;
    
    // Validate required fields
    if (!title || !status || !priority) {
      return res.status(400).json({ message: 'Title, status, and priority are required' });
    }

    // Ensure user is authenticated for task creation
    if (!req.user || !req.user.id) {
      console.error('No user ID found in createTask');
      return res.status(401).json({ message: 'User not authenticated' });
    }

    // Get the highest order index if not provided
    let order = order_index;
    if (order === undefined) {
      try {
        const result = await req.db.query(
          'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM tasks WHERE user_id = $1',
          [req.user.id]
        );
        order = result.rows[0]?.next_order || 1;
      } catch (error) {
        console.error('Error getting next order index:', error);
        order = 1; // Default to 1 if there's an error
      }
    }

    try {
      const { rows } = await req.db.query(
        `INSERT INTO tasks 
         (user_id, title, description, status, priority, due_date, order_index, is_pinned)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [
          req.user.id,
          title,
          description || null,
          status,
          priority,
          due_date || null,
          order,
          is_pinned || false
        ]
      );

      console.log(`Created task for user ${req.user.id}:`, rows[0].id);
      return res.status(201).json(rows[0]);
    } catch (dbError) {
      console.error('Database error in createTask:', {
        error: dbError.message,
        query: 'INSERT INTO tasks',
        userId: req.user.id,
        stack: dbError.stack
      });
      
      // Handle specific database errors
      if (dbError.code === '23505') { // Unique violation
        return res.status(409).json({ 
          message: 'A task with these details already exists' 
        });
      }
      
      throw dbError; // Re-throw for the outer catch
    }
  } catch (error) {
    console.error('Unexpected error in createTask:', {
      error: error.message,
      stack: error.stack,
      user: req.user || 'no user'
    });
    
    res.status(500).json({ 
      message: 'Internal server error while creating task',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// Update a task
const updateTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const { title, description, status, priority, due_date, order_index, is_pinned } = req.body;

    // First, verify the task exists and belongs to the user
    const taskResult = await req.db.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [taskId, req.user.id]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Update the task
    const { rows } = await req.db.query(
      `UPDATE tasks SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        status = COALESCE($3, status),
        priority = COALESCE($4, priority),
        due_date = $5,
        order_index = COALESCE($6, order_index),
        is_pinned = COALESCE($7, is_pinned),
        updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [
        title,
        description,
        status,
        priority,
        due_date || null,
        order_index,
        is_pinned,
        taskId,
        req.user.id
      ]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json(rows[0]);
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({ message: 'Error updating task' });
  }
};

// Delete a task
const deleteTask = async (req, res) => {
  try {
    const taskId = req.params.id;

    // First, verify the task exists and belongs to the user
    const taskResult = await req.db.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [taskId, req.user.id]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Delete the task (cascade will handle subtasks)
    await req.db.query('DELETE FROM tasks WHERE id = $1 AND user_id = $2', [taskId, req.user.id]);
    
    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ message: 'Error deleting task' });
  }
};

const express = require('express');
const router = express.Router();

// Apply auth middleware
router.use(withAuth);

// Define routes
router.get('/', getTasks);
router.post('/', createTask);
router.put('/:id', updateTask);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

// Handle unsupported methods
router.all('*', (req, res) => {
  res.setHeader('Allow', ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
  res.status(405).json({ message: `Method ${req.method} Not Allowed` });
});

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Tasks API error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { error: err.message })
  });
});

module.exports = router;
