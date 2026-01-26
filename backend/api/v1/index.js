const express = require('express');
const tasksRouter = require('./tasks');

const createV1Router = (pool) => {
  const router = express.Router();

  // Mount task routes
  router.use('/tasks', tasksRouter(pool));

  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({ status: 'ok', version: 'v1' });
  });

  return router;
};

module.exports = createV1Router;
