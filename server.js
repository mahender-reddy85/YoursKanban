import express from "express";
const app = express();

// Middleware
app.use(express.json());

// Debug middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Test routes
app.get("/", (req, res) => {
  res.status(200).json({ ok: true, message: "Backend running" });
});

app.get("/__routes", (req, res) => {
  res.status(200).json({ ok: true, message: "Routes loaded" });
});

app.post("/api/auth/register", (req, res) => {
  res.status(200).json({ 
    ok: true, 
    message: "Register working", 
    body: req.body 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    ok: false, 
    error: 'Internal Server Error' 
  });
});

// Start server
const PORT = process.env.PORT || 10000;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Database: ${process.env.DATABASE_URL ? 'Configured' : 'Not configured'}`);
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});
