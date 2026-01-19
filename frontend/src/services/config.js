// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://yourskanban.onrender.com';

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    REGISTER: '/api/auth/register',
    ME: '/api/auth/me',
    LOGOUT: '/api/auth/logout'
  },
  TASKS: {
    BASE: '/api/tasks',
    REORDER: '/api/tasks/reorder'
  }
};

export const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
};

// Local Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'yourskanban_auth_token',
  THEME: 'yourskanban_theme'
};
