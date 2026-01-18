const { validationResult } = require('express-validator');
const { query } = require('../db');
const { v4: uuidv4 } = require('uuid');

/**
 * Get all tasks for the authenticated user
 */
const getTasks = async (req, res) => {
  try {
    const { status } = req.query;
    
    let queryStr = `
      SELECT t.*, 
             (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) as subtask_count,
             (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.is_done = true) as completed_subtasks
      FROM tasks t
      WHERE t.user_id = $1
    `;
    
    const queryParams = [req.user.id];
    
    // Filter by status if provided
    if (status && ['todo', 'progress', 'done'].includes(status)) {
      queryStr += ` AND t.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }
    
    // Order by pinned first, then by order_index
    queryStr += ' ORDER BY t.is_pinned DESC, t.order_index ASC, t.created_at DESC';
    
    const result = await query(queryStr, queryParams);
    
    // Get subtasks for each task
    const tasksWithSubtasks = await Promise.all(result.rows.map(async (task) => {
      const subtasks = await getSubtasksForTask(task.id);
      return {
        ...task,
        subtasks
      };
    }));
    
    res.json({
      success: true,
      count: tasksWithSubtasks.length,
      data: tasksWithSubtasks
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching tasks'
    });
  }
};

/**
 * Get a single task by ID
 */
const getTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    const taskResult = await query(
      `SELECT t.*, 
              (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) as subtask_count,
              (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.is_done = true) as completed_subtasks
       FROM tasks t 
       WHERE t.id = $1 AND t.user_id = $2`,
      [id, req.user.id]
    );
    
    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Task not found or access denied'
      });
    }
    
    const task = taskResult.rows[0];
    const subtasks = await getSubtasksForTask(task.id);
    
    res.json({
      success: true,
      data: {
        ...task,
        subtasks
      }
    });
  } catch (error) {
    console.error('Get task error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while fetching task'
    });
  }
};

/**
 * Create a new task
 */
const createTask = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { 
      title, 
      description = '', 
      status = 'todo', 
      priority = 'medium', 
      due_date = null,
      subtasks = []
    } = req.body;
    
    // Start transaction
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get the maximum order_index for the user's tasks in this status
      const orderResult = await client.query(
        'SELECT COALESCE(MAX(order_index), 0) as max_order FROM tasks WHERE user_id = $1 AND status = $2',
        [req.user.id, status]
      );
      
      const orderIndex = (orderResult.rows[0].max_order || 0) + 1;
      
      // Insert task
      const taskResult = await client.query(
        `INSERT INTO tasks (
          user_id, title, description, status, priority, due_date, order_index
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *`,
        [req.user.id, title, description, status, priority, due_date, orderIndex]
      );
      
      const task = taskResult.rows[0];
      
      // Insert subtasks if any
      if (subtasks && subtasks.length > 0) {
        const subtaskValues = [];
        const subtaskParams = [];
        let paramIndex = 1;
        
        subtasks.forEach((subtask, index) => {
          subtaskParams.push(
            task.id,                    // task_id
            req.user.id,                // user_id
            subtask.text || '',         // text
            subtask.is_done || false,   // is_done
            index + 1                   // order_index
          );
          
          subtaskValues.push(
            `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`
          );
          
          paramIndex += 5;
        });
        
        await client.query(
          `INSERT INTO subtasks (task_id, user_id, text, is_done, order_index)
           VALUES ${subtaskValues.join(', ')}`,
          subtaskParams
        );
      }
      
      // Get the created task with subtasks
      const subtasksResult = await client.query(
        'SELECT * FROM subtasks WHERE task_id = $1 ORDER BY order_index',
        [task.id]
      );
      
      await client.query('COMMIT');
      
      // Log activity
      await logActivity(req.user.id, task.id, 'task_created', {
        title: task.title,
        status: task.status
      });
      
      res.status(201).json({
        success: true,
        data: {
          ...task,
          subtasks: subtasksResult.rows
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while creating task'
    });
  }
};

/**
 * Update a task
 */
const updateTask = async (req, res) => {
  try {
    // Validate request
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { id } = req.params;
    const { 
      title, 
      description, 
      status, 
      priority, 
      due_date,
      is_pinned,
      order_index,
      subtasks
    } = req.body;
    
    // Start transaction
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get the current task to check ownership and current status
      const currentTask = await client.query(
        'SELECT * FROM tasks WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [id, req.user.id]
      );
      
      if (currentTask.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Task not found or access denied'
        });
      }
      
      const currentStatus = currentTask.rows[0].status;
      
      // Build the update query dynamically based on provided fields
      const updateFields = [];
      const queryParams = [id, req.user.id];
      let paramIndex = 3;
      
      if (title !== undefined) {
        updateFields.push(`title = $${paramIndex++}`);
        queryParams.push(title);
      }
      
      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        queryParams.push(description);
      }
      
      if (status !== undefined && ['todo', 'progress', 'done'].includes(status)) {
        updateFields.push(`status = $${paramIndex++}`);
        queryParams.push(status);
      }
      
      if (priority !== undefined && ['low', 'medium', 'high'].includes(priority)) {
        updateFields.push(`priority = $${paramIndex++}`);
        queryParams.push(priority);
      }
      
      if (due_date !== undefined) {
        updateFields.push(`due_date = $${paramIndex++}`);
        queryParams.push(due_date);
      }
      
      if (is_pinned !== undefined) {
        updateFields.push(`is_pinned = $${paramIndex++}`);
        queryParams.push(is_pinned);
      }
      
      if (order_index !== undefined) {
        updateFields.push(`order_index = $${paramIndex++}`);
        queryParams.push(order_index);
      }
      
      // If there's nothing to update, return the current task
      if (updateFields.length === 0) {
        const task = currentTask.rows[0];
        const subtasksResult = await client.query(
          'SELECT * FROM subtasks WHERE task_id = $1 ORDER BY order_index',
          [task.id]
        );
        
        return res.json({
          success: true,
          data: {
            ...task,
            subtasks: subtasksResult.rows
          }
        });
      }
      
      // Add updated_at to the update fields
      updateFields.push('updated_at = NOW()');
      
      // Update the task
      const updateQuery = `
        UPDATE tasks 
        SET ${updateFields.join(', ')}
        WHERE id = $1 AND user_id = $2
        RETURNING *
      `;
      
      const result = await client.query(updateQuery, queryParams);
      const updatedTask = result.rows[0];
      
      // Handle subtasks if provided
      if (subtasks && Array.isArray(subtasks)) {
        // Delete existing subtasks
        await client.query(
          'DELETE FROM subtasks WHERE task_id = $1 AND user_id = $2',
          [id, req.user.id]
        );
        
        // Insert updated subtasks
        if (subtasks.length > 0) {
          const subtaskValues = [];
          const subtaskParams = [];
          let paramIndex = 1;
          
          subtasks.forEach((subtask, index) => {
            subtaskParams.push(
              id,                        // task_id
              req.user.id,               // user_id
              subtask.text || '',        // text
              subtask.is_done || false,  // is_done
              index + 1                  // order_index
            );
            
            subtaskValues.push(
              `($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4})`
            );
            
            paramIndex += 5;
          });
          
          await client.query(
            `INSERT INTO subtasks (task_id, user_id, text, is_done, order_index)
             VALUES ${subtaskValues.join(', ')}`,
            subtaskParams
          );
        }
      }
      
      // Get the updated task with subtasks
      const subtasksResult = await client.query(
        'SELECT * FROM subtasks WHERE task_id = $1 ORDER BY order_index',
        [id]
      );
      
      await client.query('COMMIT');
      
      // Log activity
      const action = status && status !== currentStatus ? 'task_status_changed' : 'task_updated';
      await logActivity(req.user.id, id, action, {
        title: updatedTask.title,
        status: updatedTask.status,
        previous_status: currentStatus
      });
      
      res.json({
        success: true,
        data: {
          ...updatedTask,
          subtasks: subtasksResult.rows || []
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while updating task'
    });
  }
};

/**
 * Delete a task
 */
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Start transaction
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get the task before deleting to log activity
      const taskResult = await client.query(
        'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      
      if (taskResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Task not found or access denied'
        });
      }
      
      const task = taskResult.rows[0];
      
      // Delete the task (cascading delete will handle subtasks)
      await client.query(
        'DELETE FROM tasks WHERE id = $1 AND user_id = $2',
        [id, req.user.id]
      );
      
      await client.query('COMMIT');
      
      // Log activity
      await logActivity(req.user.id, id, 'task_deleted', {
        title: task.title,
        status: task.status
      });
      
      res.json({
        success: true,
        data: {}
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while deleting task'
    });
  }
};

/**
 * Reorder tasks
 */
const reorderTasks = async (req, res) => {
  try {
    const { tasks } = req.body;
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Tasks array is required'
      });
    }
    
    // Start transaction
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Update order_index for each task
      for (const [index, task] of tasks.entries()) {
        await client.query(
          'UPDATE tasks SET order_index = $1 WHERE id = $2 AND user_id = $3',
          [index, task.id, req.user.id]
        );
      }
      
      await client.query('COMMIT');
      
      res.json({
        success: true,
        data: {}
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Reorder tasks error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error while reordering tasks'
    });
  }
};

/**
 * Get subtasks for a task
 * @private
 */
async function getSubtasksForTask(taskId) {
  try {
    const result = await query(
      'SELECT * FROM subtasks WHERE task_id = $1 ORDER BY order_index',
      [taskId]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching subtasks:', error);
    return [];
  }
}

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
  getTasks,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  reorderTasks
};
