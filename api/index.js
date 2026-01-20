import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import createError from 'http-errors';
import 'dotenv/config';

// Import route handlers
import register from './auth/register.js';
import login from './auth/login.js';
import me from './auth/me.js';
import tasks from './tasks.js';

const app = express();

// Middleware
app.use(helmet());
app.use(compression());

// CORS configuration
const allowedOrigins = [
  'http://localhost:3000',
  'https://yourskanban.vercel.app',
  'https://www.yourskanban.vercel.app',
  'https://yourskanban.onrender.com'
];

app.use(cors({
  origin: function(origin, callback) {
    // allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.some(allowedOrigin => 
      origin === allowedOrigin || 
      origin.startsWith(allowedOrigin.replace('https://', 'http://'))
    )) {
      return callback(null, true);
    }
    const msg = `The CORS policy for this site does not allow access from ${origin}`;
    return callback(new Error(msg), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

// Handle preflight requests
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Backend running" });
});

// Ping route
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, message: "pong" });
});

// Logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again after 15 minutes'
});
app.use(limiter);

// API Routes
app.use('/api/auth/register', register);
app.use('/api/auth/login', login);
app.use('/api/auth/me', me);
app.use('/api/tasks', tasks);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Debug routes
app.get("/__routes", (req, res) => {
  res.json({
    ok: true,
    message: "Server running",
    hint: "If auth is mounted, POST /api/auth/register should exist"
  });
});

app.get("/", (req, res) => {
  res.json({ ok: true, message: "YoursKanban backend running" });
});

app.get("/api", (req, res) => {
  res.json({ ok: true, message: "API root working" });
});

// 404 handler
app.use((req, res, next) => {
  next(createError(404, 'Not Found'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: {
      status: err.status || 500,
      message: err.message || 'Internal Server Error'
    }
  });
});

// Make sure the root route is the last route defined before the 404 handler
app.get("/", (req, res) => {
  res.json({ ok: true, message: "Backend running" });
});

// Start server
const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on http://0.0.0.0:${PORT}`);
  console.log(`API Documentation: http://0.0.0.0:${PORT}/api-docs`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err);
  server.close(() => {
    process.exit(1);
  });
});

export default app;
