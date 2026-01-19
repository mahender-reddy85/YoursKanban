import { protect } from '../lib/auth.js';
import db from '../lib/db.js';

async function handler(req, res) {
  switch (req.method) {
    case 'GET':
      return getTasks(req, res);
    case 'POST':
      return createTask(req, res);
    case 'PUT':
      return updateTask(req, res);
    case 'DELETE':
      return deleteTask(req, res);
    default:
      return res.status(405).json({ message: 'Method not allowed' });
  }
}

async function getTasks(req, res) {
  try {
    const result = await db.query(
      `SELECT t.*, u.name as author_name 
       FROM tasks t 
       JOIN users u ON t.user_id = u.id 
       WHERE t.user_id = $1 
       ORDER BY t.position`,
      [req.userId]
    );
    return res.status(200).json({ tasks: result.rows });
  } catch (error) {
    console.error('GET TASKS ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function createTask(req, res) {
  try {
    const { title, description, status, column_id } = req.body;
    
    if (!title || !status || !column_id) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Get the highest position for the new task
    const positionResult = await db.query(
      'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM tasks WHERE user_id = $1 AND column_id = $2',
      [req.userId, column_id]
    );
    
    const nextPosition = positionResult.rows[0].next_position;

    const result = await db.query(
      `INSERT INTO tasks (user_id, title, description, status, position, column_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [req.userId, title, description || null, status, nextPosition, column_id]
    );

    return res.status(201).json({ task: result.rows[0] });
  } catch (error) {
    console.error('CREATE TASK ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function updateTask(req, res) {
  try {
    const { id } = req.query;
    const { title, description, status, position, column_id } = req.body;

    if (!id) {
      return res.status(400).json({ message: 'Task ID is required' });
    }

    // First, get the current task to verify ownership
    const currentTask = await db.query(
      'SELECT * FROM tasks WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (currentTask.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found or access denied' });
    }

    // Update the task
    const result = await db.query(
      `UPDATE tasks 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           position = COALESCE($4, position),
           column_id = COALESCE($5, column_id),
           updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING *`,
      [title, description, status, position, column_id, id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    return res.status(200).json({ task: result.rows[0] });
  } catch (error) {
    console.error('UPDATE TASK ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}

async function deleteTask(req, res) {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ message: 'Task ID is required' });
    }

    const result = await db.query(
      'DELETE FROM tasks WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found or access denied' });
    }

    return res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('DELETE TASK ERROR:', error);
    return res.status(500).json({ error: error.message });
  }
}

export default protect(handler);
