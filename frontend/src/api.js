const API_BASE_URL = '/api';

// Helper function to handle API requests
const apiRequest = async (endpoint, options = {}) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  // Add authorization header if token exists
  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
  };

  // Add body to config if it exists
  if (options.body) {
    config.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (!response.ok) {
      // If 401 Unauthorized, clear token and redirect to login
      if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
      }
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

// Auth API
export const authAPI = {
  // Register a new user
  register: async (name, email, password) => {
    return apiRequest('/register', {
      method: 'POST',
      body: { name, email, password },
    });
  },

  // Login user
  login: async (email, password) => {
    const data = await apiRequest('/login', {
      method: 'POST',
      body: { email, password },
    });
    
    if (data.token) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    
    return data;
  },

  // Get current user
  getMe: async () => {
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      try {
        // Try to validate the token with the server
        const data = await apiRequest('/me');
        localStorage.setItem('user', JSON.stringify(data.user));
        return data.user;
      } catch (error) {
        // If token is invalid, clear local storage
        if (error.message.includes('401')) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login.html';
        }
        throw error;
      }
    }
    return null;
  },

  // Logout user
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login.html';
  },

  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },
};

// Tasks API
export const tasksAPI = {
  // Get all tasks
  getTasks: async () => {
    return apiRequest('/tasks');
  },

  // Create a new task
  createTask: async (taskData) => {
    return apiRequest('/tasks', {
      method: 'POST',
      body: taskData,
    });
  },

  // Update a task
  updateTask: async (taskId, updates) => {
    return apiRequest(`/tasks/${taskId}`, {
      method: 'PUT',
      body: updates,
    });
  },

  // Delete a task
  deleteTask: async (taskId) => {
    return apiRequest(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  },

  // Reorder tasks
  reorderTasks: async (updates) => {
    return apiRequest('/tasks/reorder', {
      method: 'PUT',
      body: { updates },
    });
  },
};

// Subtasks API
export const subtasksAPI = {
  // Create a subtask
  createSubtask: async (taskId, text) => {
    return apiRequest(`/tasks/${taskId}/subtasks`, {
      method: 'POST',
      body: { text },
    });
  },

  // Update a subtask
  updateSubtask: async (subtaskId, updates) => {
    return apiRequest(`/subtasks/${subtaskId}`, {
      method: 'PUT',
      body: updates,
    });
  },

  // Delete a subtask
  deleteSubtask: async (subtaskId) => {
    return apiRequest(`/subtasks/${subtaskId}`, {
      method: 'DELETE',
    });
  },
};

// Initialize the API client
const initAPI = () => {
  // Add request interceptor to handle token refresh if needed
  // This is a placeholder for future implementation
};

export default {
  auth: authAPI,
  tasks: tasksAPI,
  subtasks: subtasksAPI,
  init: initAPI,
};
