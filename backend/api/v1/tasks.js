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
                COALESCE(
                  (
                    SELECT json_agg(
                      json_build_object(
                        'id', st.id,
                        'title', st.title,
                        'is_completed', st.is_completed,
                        'created_at', st.created_at,
                        'updated_at', st.updated_at
                      )
                    )
                    FROM subtasks st
                    WHERE st.task_id = t.id
                  ),
                  '[]'::json
                ) AS subtasks
         FROM tasks t
         WHERE t.user_id = $1
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
              COALESCE(
                (SELECT json_agg(
                  json_build_object(
                    'id', st.id,
                    'title', st.title,
                    'is_completed', st.is_completed,
                    'created_at', st.created_at,
                    'updated_at', st.updated_at
                  )
                )
                FROM subtasks st 
                WHERE st.task_id = t.id),
                '[]'::json
              ) as subtasks
       FROM tasks t
       WHERE t.id = $1 AND t.user_id = $2`,
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
    const { id: userId, isGuest } = req.user;
    
    // Safety check to prevent future broken tasks
    if (!userId) {
      throw new Error("User ID missing in createTask");
    }
    
    const { title, description, status, priority, dueDate, position, subtasks, pinned } = req.body;

    // Handle dueDate conversion
    let formattedDueDate = null;
    if (dueDate) {
      try {
        // Convert the timestamp to a PostgreSQL TIMESTAMP if it exists
        const timestamp = typeof dueDate === 'string' ? parseInt(dueDate, 10) : dueDate;
        
        // If the timestamp is in milliseconds (likely from JavaScript's Date.getTime())
        if (timestamp > 1e12) {
          formattedDueDate = new Date(timestamp).toISOString();
        } else if (timestamp > 1e9) {
          formattedDueDate = new Date(timestamp * 1000).toISOString();
        } else {
          formattedDueDate = new Date(timestamp).toISOString();
        }
      } catch (error) {

        // If there's an error parsing the date, just set it to null
        formattedDueDate = null;
      }
    }

    // Get the next position for the task if not provided
    let taskPosition = position;
    if (taskPosition === undefined) {
      const positionResult = await pool.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM tasks WHERE user_id = $1',
        [userId]
      );
      taskPosition = positionResult.rows[0].next_position;
    }

    const result = await pool.query(
      `INSERT INTO tasks (user_id, title, description, status, priority, due_date, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId, 
        title, 
        description || null, 
        status || 'todo', 
        priority || 'medium', 
        formattedDueDate,
        taskPosition
      ]
    );

    const createdTask = result.rows[0];

    // Create subtasks if provided
    if (subtasks && Array.isArray(subtasks) && subtasks.length > 0) {
      for (let i = 0; i < subtasks.length; i++) {
        const st = subtasks[i];
        const subtaskTitle = st.title || st.text || '';
        const subtaskDescription = st.description || st.text || '';
        const isCompleted = st.is_completed || st.completed || st.is_done || false;

        await pool.query(
          `INSERT INTO subtasks (task_id, title, description, is_completed)
           VALUES ($1, $2, $3, $4)`,
          [createdTask.id, subtaskTitle, subtaskDescription, isCompleted]
        );
      }
    }

    res.status(201).json({
      success: true,
      data: createdTask
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
    const allowedFields = ['title', 'description', 'status', 'priority', 'due_date', 'position'];
    Object.entries(updates).forEach(([key, value]) => {
      if (allowedFields.includes(key)) {
        // Handle due_date conversion for updates
        if (key === 'due_date' && value) {
          try {
            const timestamp = typeof value === 'string' ? parseInt(value, 10) : value;
            
            if (timestamp > 1e12) {
              value = new Date(timestamp).toISOString();
            } else if (timestamp > 1e9) {
              value = new Date(timestamp * 1000).toISOString();
            } else {
              value = new Date(timestamp).toISOString();
            }
          } catch (error) {
    
            value = null;
          }
        }
        
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
