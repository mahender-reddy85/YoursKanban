// Simple test script to verify the ping endpoint
import express from 'express';

const app = express();
const port = 3001;

// Import the ping handler
import ping from './api/ping.js';

// Set up the route
app.get('/api/ping', (req, res) => {
  ping(req, res);
});

// Start the server
app.listen(port, () => {
  console.log(`Test server running on http://localhost:${port}`);
  console.log(`Test the ping endpoint: http://localhost:${port}/api/ping`);
});
