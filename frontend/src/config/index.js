// API Configuration
export const API_BASE_URL = 'https://yourskanban.onrender.com';

// Frontend URL
export const FRONTEND_URL = 'https://yourskanban.vercel.app';

// Default request headers
export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    ME: '/api/auth/me'
  },
  TASKS: {
    BASE: '/api/tasks',
    BY_ID: (id) => `/api/tasks/${id}`,
    REORDER: '/api/tasks/reorder'
  }
};
