const { protect } = require('../lib/auth');

// Helper function to handle protected routes
const withAuth = (handler) => {
  return async (req, res) => {
    try {
      // Add user to request object if authenticated
      await new Promise((resolve, reject) => {
        protect(req, res, (result) => {
          if (result instanceof Error) return reject(result);
          resolve(result);
        });
      });
      return handler(req, res);
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(401).json({ message: 'Not authorized' });
    }
  };
};

// Get all tasks for the authenticated user
const getTasks = async (req, res) => {
  try {
    const { rows } = await req.db.query(
      'SELECT * FROM tasks WHERE user_id = $1 ORDER BY order_index, created_at DESC',
      [req.user.id]
    );
    res.status(200).json(rows);
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({ message: 'Error fetching tasks' });
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

    // Get the highest order index if not provided
    let order = order_index;
    if (order === undefined) {
      const result = await req.db.query(
        'SELECT COALESCE(MAX(order_index), 0) + 1 as next_order FROM tasks WHERE user_id = $1',
        [req.user.id]
      );
      order = result.rows[0].next_order;
    }

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

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({ message: 'Error creating task' });
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

// Route handler
const handler = async (req, res) => {
  // Set db on request for use in withAuth
  req.db = db;

  try {
    switch (req.method) {
      case 'GET':
        return await withAuth(getTasks)(req, res);
      case 'POST':
        return await withAuth(createTask)(req, res);
      case 'PUT':
        return await withAuth(updateTask)(req, res);
      case 'DELETE':
        return await withAuth(deleteTask)(req, res);
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).json({ message: `Method ${req.method} not allowed` });
    }
  } catch (error) {
    console.error('Tasks route error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = handler;
