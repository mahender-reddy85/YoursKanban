const express = require('express');
const { verifyFirebaseToken } = require('../middleware/firebaseAuth');

// Create a router with database pool
const createTasksRouter = (pool) => {
  const router = express.Router();
  
  // Middleware to add db to request and handle unauthenticated users
  router.use(async (req, res, next) => {
    req.db = pool;
    
    // If user is not authenticated, create a guest user
    if (!req.user) {
      try {
        // Check if guest user exists
        const guestUser = await pool.query(
          'SELECT id FROM users WHERE email = $1', 
          ['guest@yourskanban.com']
        );
        
        if (guestUser.rows.length === 0) {
          // Create guest user if doesn't exist
          const newGuest = await pool.query(
            `INSERT INTO users (email, name, is_guest) 
             VALUES ($1, 'Guest User', true) 
             RETURNING id`,
            ['guest@yourskanban.com']
          );
          req.user = { id: newGuest.rows[0].id, isGuest: true };
        } else {
          req.user = { id: guestUser.rows[0].id, isGuest: true };
        }
      } catch (error) {
        console.error('Error setting up guest user:', error);
        return res.status(500).json({ message: 'Error setting up guest session' });
      }
    }
    
    next();
  });
  
  // Authentication middleware - allow all requests through
  const withAuth = (req, res, next) => {
    // Always continue to next middleware
    next();
  };

  // Get all tasks (works for both authenticated and unauthenticated users)
  const getTasks = async (req, res) => {
    console.log('getTasks called, user:', req.user ? `user (${req.user.id})` : 'unauthenticated');
    
    // At this point, req.user should always exist due to our middleware
    if (!req.user) {
      console.error('Unexpected: No user object in request');
      return res.status(500).json({ message: 'Internal server error' });
    }
    
    // First, check if the tasks table exists
    try {
      const tableCheck = await req.db.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'tasks'
        )`
      );
      
      if (!tableCheck.rows[0].exists) {
        console.error('Tasks table does not exist in the database');
        return res.status(200).json([]);
      }
    } catch (checkError) {
      console.error('Error checking for tasks table:', checkError);
      return res.status(500).json({ 
        message: 'Error checking database schema',
        ...(process.env.NODE_ENV === 'development' && { error: checkError.message })
      });
    }
    
    try {
      // Get or create user in the database
      const firebaseUid = req.user.uid;
      let dbUserId;
      
      // Check if user exists in database
      const userCheck = await req.db.query(
        'SELECT id FROM users WHERE firebase_uid = $1', 
        [firebaseUid]
      );
      
      if (userCheck.rows.length === 0) {
        // Create new user if they don't exist
        console.log('Creating new user for Firebase UID:', firebaseUid);
        const newUser = await req.db.query(
          'INSERT INTO users (firebase_uid, email) VALUES ($1, $2) RETURNING id',
          [firebaseUid, req.user.email]
        );
        dbUserId = newUser.rows[0].id;
      } else {
        dbUserId = userCheck.rows[0].id;
      }
      
      console.log('Querying tasks for user ID:', dbUserId);
      const queryText = `
        SELECT t.*, 
               (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) as subtask_count,
               (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.is_done = true) as completed_subtasks
        FROM tasks t 
        WHERE t.user_id = $1 
        ORDER BY t."order_index" ASC, t.created_at DESC`;
      
      console.log('Executing query:', queryText);
      const result = await req.db.query(queryText, [dbUserId]);
      console.log(`Found ${result.rows.length} tasks for user ${dbUserId}`);
      return res.status(200).json(result.rows);
      
    } catch (error) {
      console.error('Error in getTasks:', {
        message: error.message,
        stack: error.stack,
        user: req.user ? { uid: req.user.uid, email: req.user.email } : 'no user'
      });
      
      return res.status(500).json({ 
        message: 'Error fetching tasks',
        ...(process.env.NODE_ENV === 'development' && { 
          error: error.message,
          stack: error.stack 
        })
      });
    }
  };

  // Create a new task
  const createTask = async (req, res) => {
    try {
      const { title, description, status, priority, due_date, is_pinned } = req.body;
      
      if (!title || !status || !priority) {
        return res.status(400).json({ 
          message: 'Title, status, and priority are required' 
        });
      }
      
      // Get or create user in the database
      const firebaseUid = req.user.uid;
      let dbUserId;
      
      // Check if user exists in database
      const userCheck = await req.db.query(
        'SELECT id FROM users WHERE firebase_uid = $1', 
        [firebaseUid]
      );
      
      if (userCheck.rows.length === 0) {
        // Create new user if they don't exist
        console.log('Creating new user for Firebase UID:', firebaseUid);
        const newUser = await req.db.query(
          'INSERT INTO users (firebase_uid, email) VALUES ($1, $2) RETURNING id',
          [firebaseUid, req.user.email]
        );
        dbUserId = newUser.rows[0].id;
      } else {
        dbUserId = userCheck.rows[0].id;
      }
      
      // Get the next order index
      const orderResult = await req.db.query(
        'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM tasks WHERE user_id = $1',
        [dbUserId]
      );
      const order = orderResult.rows[0].next_order;
      
      // Create the task
      const result = await req.db.query(
        `INSERT INTO tasks 
         (user_id, title, description, status, priority, due_date, order_index, is_pinned)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          dbUserId,
          title,
          description || null,
          status,
          priority,
          due_date || null,
          order,
          is_pinned || false
        ]
      );
      
      return res.status(201).json(result.rows[0]);
      
    } catch (error) {
      console.error('Error in createTask:', {
        message: error.message,
        stack: error.stack,
        body: req.body,
        user: req.user ? { uid: req.user.uid, email: req.user.email } : 'no user'
      });
      
      return res.status(500).json({ 
        message: 'Error creating task',
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
      
      if (!taskId) {
        return res.status(400).json({ message: 'Task ID is required' });
      }
      
      // Get user ID from Firebase UID
      const userResult = await req.db.query(
        'SELECT id FROM users WHERE firebase_uid = $1',
        [req.user.uid]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const dbUserId = userResult.rows[0].id;
      
      // Build the update query dynamically based on provided fields
      const updates = [];
      const values = [taskId, dbUserId];
      let paramIndex = 3;
      
      if (title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(title);
      }
      
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      
      if (status !== undefined) {
        updates.push(`status = $${paramIndex++}`);
        values.push(status);
      }
      
      if (priority !== undefined) {
        updates.push(`priority = $${paramIndex++}`);
        values.push(priority);
      }
      
      if (due_date !== undefined) {
        updates.push(`due_date = $${paramIndex++}`);
        values.push(due_date);
      }
      
      if (order_index !== undefined) {
        updates.push(`order_index = $${paramIndex++}`);
        values.push(order_index);
      }
      
      if (is_pinned !== undefined) {
        updates.push(`is_pinned = $${paramIndex++}`);
        values.push(is_pinned);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ message: 'No valid fields to update' });
      }
      
      // Add updated_at timestamp
      updates.push('updated_at = NOW()');
      
      const query = {
        text: `UPDATE tasks 
               SET ${updates.join(', ')}
               WHERE id = $1 AND user_id = $2
               RETURNING *`,
        values: values
      };
      
      const result = await req.db.query(query);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ message: 'Task not found or not authorized' });
      }
      
      return res.status(200).json(result.rows[0]);
      
    } catch (error) {
      console.error('Error in updateTask:', {
        message: error.message,
        stack: error.stack,
        params: req.params,
        body: req.body,
        user: req.user ? { uid: req.user.uid, email: req.user.email } : 'no user'
      });
      
      return res.status(500).json({ 
        message: 'Error updating task',
        ...(process.env.NODE_ENV === 'development' && { 
          error: error.message,
          stack: error.stack 
        })
      });
    }
  };

  // Delete a task
  const deleteTask = async (req, res) => {
    try {
      const taskId = req.params.id;
      
      if (!taskId) {
        return res.status(400).json({ message: 'Task ID is required' });
      }
      
      // Get user ID from Firebase UID
      const userResult = await req.db.query(
        'SELECT id FROM users WHERE firebase_uid = $1',
        [req.user.uid]
      );
      
      if (userResult.rows.length === 0) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      const dbUserId = userResult.rows[0].id;
      
      // Delete the task (cascade will handle subtasks)
      const result = await req.db.query(
        'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *',
        [taskId, dbUserId]
      );
      
      if (result.rowCount === 0) {
        return res.status(404).json({ message: 'Task not found or not authorized' });
      }
      
      return res.status(200).json({ message: 'Task deleted successfully' });
      
    } catch (error) {
      console.error('Error in deleteTask:', {
        message: error.message,
        stack: error.stack,
        params: req.params,
        user: req.user ? { uid: req.user.uid, email: req.user.email } : 'no user'
      });
      
      return res.status(500).json({ 
        message: 'Error deleting task',
        ...(process.env.NODE_ENV === 'development' && { 
          error: error.message,
          stack: error.stack 
        })
      });
    }
  };

  // Apply auth middleware
  router.use(withAuth);

  // Routes
  router.get('/', getTasks);
  router.post('/', createTask);
  router.put('/:id', updateTask);
  router.delete('/:id', deleteTask);

  // Handle unsupported methods
  router.all('*', (req, res) => {
    res.status(405).json({ 
      success: false,
      code: 'METHOD_NOT_ALLOWED',
      message: `Method ${req.method} Not Allowed` 
    });
  });

  // Error handling middleware
  router.use((err, req, res, next) => {
    console.error('Tasks API error:', err);
    
    // Handle specific error types
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        errors: err.errors
      });
    }
    
    res.status(500).json({ 
      success: false,
      code: 'SERVER_ERROR',
      message: 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { 
        error: err.message,
        stack: err.stack 
      })
    });
  });

  return router;
};

// Create a default router instance for backward compatibility
const pool = require('../lib/db').pool;
const router = createTasksRouter(pool);

// Export both the router and the factory function
module.exports = { router, createTasksRouter };
