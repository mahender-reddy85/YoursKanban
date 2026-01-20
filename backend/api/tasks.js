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
  console.log('getTasks called, user:', req.user ? `authenticated (${req.user.id})` : 'unauthenticated');
  
  if (!req.user) {
    // For unauthenticated users, return an empty array
    console.log('Returning empty array for unauthenticated user');
    return res.status(200).json([]);
  }
  
  try {
    console.log('Database pool state:', {
      totalCount: req.db.totalCount,
      idleCount: req.db.idleCount,
      waitingCount: req.db.waitingCount
    });
    
    // First, verify the user exists
    const userCheck = await req.db.query('SELECT id FROM users WHERE id = $1', [req.user.id]);
    if (userCheck.rows.length === 0) {
      console.error('User not found in database:', req.user.id);
      return res.status(404).json({ message: 'User not found' });
    }
    
    console.log('Querying tasks for user:', req.user.id);
    const queryText = `
      SELECT t.*, 
             (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) as subtask_count,
             (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.is_done = true) as completed_subtasks
      FROM tasks t 
      WHERE t.user_id = $1 
      ORDER BY t."order_index" ASC, t.created_at DESC`;
    
    console.log('Executing query:', queryText);
    const userId = req.user.id;
    const result = await req.db.query(queryText, [userId]);
    
    console.log(`Found ${result.rows.length} tasks for user ${req.user.id}`);
    return res.status(200).json(result.rows);
    
  } catch (dbError) {
    console.error('Database error in getTasks:', {
      error: dbError.message,
      code: dbError.code,
      detail: dbError.detail,
      hint: dbError.hint,
      query: dbError.query,
      position: dbError.position,
      stack: dbError.stack
    });
    return res.status(500).json({ 
      message: 'Database error while fetching tasks',
      error: process.env.NODE_ENV === 'development' ? dbError.message : undefined
    });
  }
}
    });
    res.status(500).json({ 
      message: 'Internal server error while fetching tasks',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
};

// Create a new task
const createTask = async (req, res) => {
  console.log('createTask called with body:', JSON.stringify(req.body, null, 2));
  
  try {
    // Log request details for debugging
    console.log('Request user:', req.user);
    console.log('Database pool state:', {
      totalCount: req.db.totalCount,
      idleCount: req.db.idleCount,
      waitingCount: req.db.waitingCount
    });
    
    const { title, description, status, priority, due_date, order_index = 0, is_pinned = false } = req.body;
    
    // Validate required fields with more detailed error messages
    if (!title) return res.status(400).json({ message: 'Title is required' });
    if (!status) return res.status(400).json({ message: 'Status is required' });
    if (!priority) return res.status(400).json({ message: 'Priority is required' });

    // Ensure user is authenticated for task creation
    if (!req.user || !req.user.id) {
      console.error('No user ID found in createTask');
      return res.status(401).json({ message: 'User not authenticated' });
    }
    
    // Verify user exists in database
    try {
      const userCheck = await req.db.query('SELECT id FROM users WHERE id = $1', [req.user.id]);
      if (userCheck.rows.length === 0) {
        console.error('User not found in database:', req.user.id);
        return res.status(404).json({ message: 'User not found' });
      }
    } catch (userCheckError) {
      console.error('Error checking user existence:', userCheckError);
      // Continue with task creation even if user check fails
    }

    console.log(`Creating task for user ${req.user.id}`, {
      title,
      status,
      priority,
      hasDescription: !!description,
      dueDate: due_date || 'not set',
      order_index: order_index !== undefined ? order_index : 'auto'
    });

    // Get the highest order index if not provided
    let order = order_index;
    if (order === undefined) {
      try {
        console.log('Getting next order index for user:', req.user.id);
        const result = await req.db.query(
          'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM tasks WHERE user_id = $1',
          [req.user.id]
        );
        order = result.rows[0]?.next_order || 1;
        console.log('Next order index:', order);
      } catch (error) {
        console.error('Error getting next order index:', {
          error: error.message,
          stack: error.stack,
          userId: req.user.id
        });
        order = 1; // Default to 1 if there's an error
      }
    }

    try {
      console.log('Executing database query with params:', {
        user_id: req.user.id,
        title,
        description: description || null,
        status,
        priority,
        due_date: due_date || null,
        order_index: order,
        is_pinned: is_pinned || false
      });

      const query = {
        text: `INSERT INTO tasks 
               (user_id, title, description, status, priority, due_date, order_index, is_pinned)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
               RETURNING *`,
        values: [
          req.user.id,
          title,
          description || null,
          status,
          priority,
          due_date || null,
          order,
          is_pinned || false
        ]
      };

      console.log('Executing query:', query.text);
      console.log('With values:', query.values);
      
      const result = await req.db.query(query);
      
      if (!result.rows || result.rows.length === 0) {
        console.error('No rows returned from INSERT query');
        return res.status(500).json({ 
          message: 'Failed to create task',
          error: 'No data returned from database'
        });
      }
      
      console.log(`Successfully created task for user ${req.user.id}:`, result.rows[0].id);
      return res.status(201).json(result.rows[0]);
      
    } catch (dbError) {
      console.error('Database error in createTask:', {
        error: dbError.message,
        code: dbError.code,
        detail: dbError.detail,
        constraint: dbError.constraint,
        table: dbError.table,
        query: query?.text,
        values: query?.values,
        stack: dbError.stack
      });
      
      // Handle specific database errors
      if (dbError.code === '23505') { // Unique violation
        return res.status(409).json({ 
          message: 'A task with these details already exists',
          details: dbError.detail
        });
      }
      
      // Handle other common PostgreSQL errors
      if (dbError.code === '22P02') { // Invalid text representation
        return res.status(400).json({
          message: 'Invalid data format',
          details: dbError.message
        });
      }
      
      // If we get here, it's an unhandled database error
      throw new Error(`Database error: ${dbError.message}`);
    }
  } catch (error) {
    console.error('Unexpected error in createTask:', {
      error: error.message,
      stack: error.stack,
      user: req.user ? { id: req.user.id } : 'no user',
      requestBody: req.body
    });
    
    res.status(500).json({ 
      message: 'Internal server error while creating task',
      ...(process.env.NODE_ENV === 'development' && { 
        error: error.message,
        stack: error.stack
      })
    });
  }
};

// Update a task
const updateTask = async (req, res) => {
  try {
    const taskId = req.params.id;
    const { title, description, status, priority, due_date, order_index, is_pinned } = req.body;

    // First, verify the task exists and belongs to the user
    const userId = req.user.id;
    const taskResult = await req.db.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
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
    const userId = req.user.id;
    const taskResult = await req.db.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [taskId, userId]
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
