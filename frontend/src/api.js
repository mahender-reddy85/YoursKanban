import { API_BASE_URL, API_ENDPOINTS, DEFAULT_HEADERS } from './config';

// Helper function to handle API responses
const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Something went wrong');
  }
  return response.json();
};

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ email, password }),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  register: async (name, email, password) => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.REGISTER}`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ name, email, password })
    });
    return handleResponse(response);
  },

  getCurrentUser: async () => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.ME}`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
      credentials: 'include'
    });
    return handleResponse(response);
  },

  logout: async () => {
    // Handle logout logic (clear tokens, etc.)
    localStorage.removeItem('authToken');
  }
};

// Tasks API
export const tasksAPI = {
  getAllTasks: async (status) => {
    let url = `${API_BASE_URL}${API_ENDPOINTS.TASKS.BASE}`;
    if (status) {
      url += `?status=${status}`;
    }
    const response = await fetch(url, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
      credentials: 'include'
    });
    return handleResponse(response);
  },

  getTask: async (id) => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TASKS.BY_ID(id)}`, {
      method: 'GET',
      headers: DEFAULT_HEADERS,
      credentials: 'include'
    });
    return handleResponse(response);
  },

  createTask: async (taskData) => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TASKS.BASE}`, {
      method: 'POST',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(taskData),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  updateTask: async (id, taskData) => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TASKS.BY_ID(id)}`, {
      method: 'PUT',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify(taskData),
      credentials: 'include'
    });
    return handleResponse(response);
  },

  deleteTask: async (id) => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TASKS.BY_ID(id)}`, {
      method: 'DELETE',
      headers: DEFAULT_HEADERS,
      credentials: 'include'
    });
    return handleResponse(response);
  },

  reorderTasks: async (updates) => {
    const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.TASKS.REORDER}`, {
      method: 'PATCH',
      headers: DEFAULT_HEADERS,
      body: JSON.stringify({ updates }),
      credentials: 'include'
    });
    return handleResponse(response);
  }
};

// Export all API functions
export default {
  auth: authAPI,
  tasks: tasksAPI
};
