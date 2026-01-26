const express = require('express');
const { AppError, errorTypes, catchAsync } = require('../../utils/errorHandler');

// Create a router with database pool
const createTasksRouter = (pool) => {
  const router = express.Router();

  // Get all tasks for the current user
  const getTasks = catchAsync(async (req, res) => {
    const { id: userId, isGuest } = req.user;
    
    const query = isGuest 
      ? 'SELECT * FROM tasks WHERE user_id = $1 ORDER BY created_at DESC'
      : `SELECT t.*, 
                json_agg(
                  json_build_object(
                    'id', s.id,
                    'title', s.title,
                    'is_completed', s.is_completed,
                    'order_index', s.order_index,
                    'created_at', s.created_at,
                    'updated_at', s.updated_at
                  ) ORDER BY s.order_index
                ) as subtasks
         FROM tasks t
         LEFT JOIN subtasks s ON t.id = s.task_id
         WHERE t.user_id = $1
         GROUP BY t.id
         ORDER BY t.created_at DESC`;

    const result = await pool.query(query, [userId]);
    
    // If guest user, format the response to match the authenticated response
    const tasks = isGuest 
      ? result.rows.map(task => ({
          ...task,
          subtasks: []
        }))
      : result.rows;

    res.json({
      success: true,
      data: tasks
    });
  });

  // Get a single task by ID
  const getTask = catchAsync(async (req, res) => {
    const { id: userId } = req.user;
    const { id } = req.params;

    const result = await pool.query(
      `SELECT t.*, 
              json_agg(
                json_build_object(
                  'id', s.id,
                  'title', s.title,
                  'is_completed', s.is_completed,
                  'order_index', s.order_index,
                  'created_at', s.created_at,
                  'updated_at', s.updated_at
                ) ORDER BY s.order_index
              ) as subtasks
       FROM tasks t
       LEFT JOIN subtasks s ON t.id = s.task_id
       WHERE t.id = $1 AND t.user_id = $2
       GROUP BY t.id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Task not found', 404, errorTypes.NOT_FOUND);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  });

  // Create a new task
  const createTask = catchAsync(async (req, res) => {
    const { id: userId } = req.user;
    const { title, description, status, priority, dueDate } = req.body;

    const result = await pool.query(
      `INSERT INTO tasks (user_id, title, description, status, priority, due_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, title, description || null, status || 'todo', priority || 'medium', dueDate || null]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  });

  // Update a task
  const updateTask = catchAsync(async (req, res) => {
    const { id: userId } = req.user;
    const { id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const setClause = [];
    const values = [];
    let paramCount = 1;

    // Add updatable fields
    const allowedFields = ['title', 'description', 'status', 'priority', 'due_date'];
    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        setClause.push(`${key} = $${paramCount++}`);
        values.push(value);
      }
    });

    if (setClause.length === 0) {
      throw new AppError('No valid fields to update', 400, errorTypes.VALIDATION_ERROR);
    }

    // Add updated_at timestamp
    setClause.push(`updated_at = NOW()`);

    values.push(id, userId);
    const result = await pool.query(
      `UPDATE tasks 
       SET ${setClause.join(', ')}
       WHERE id = $${paramCount++} AND user_id = $${paramCount}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError('Task not found', 404, errorTypes.NOT_FOUND);
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  });

  // Delete a task
  const deleteTask = catchAsync(async (req, res) => {
    const { id: userId } = req.user;
    const { id } = req.params;

    const result = await pool.query(
      `DELETE FROM tasks 
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Task not found', 404, errorTypes.NOT_FOUND);
    }

    res.status(204).send();
  });

  // Define routes
  router.route('/')
    .get(getTasks)
    .post(createTask);

  router.route('/:id')
    .get(getTask)
    .patch(updateTask)
    .delete(deleteTask);

  return router;
};

module.exports = createTasksRouter;
