// API Utility Functions
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const API_BASE = "https://yourskanban.onrender.com/api";

/**
 * Get Firebase ID token for the current user
 * @returns {Promise<string|null>} - Firebase ID token or null if not authenticated
 */
async function getFirebaseToken() {
  try {
    const user = getAuth().currentUser;
    if (!user) return null;
    return await user.getIdToken();
  } catch (error) {
    console.error('Error getting Firebase token:', error);
    return null;
  }
}

/**
 * Check if user is logged in using Firebase Auth
 * @returns {boolean} - True if user is logged in
 */
export function isLoggedIn() {
  return !!getAuth().currentUser;
}

/**
 * Get current user from Firebase Auth
 * @returns {Object|null} - Current user object or null if not logged in
 */
export function getCurrentUser() {
  const user = getAuth().currentUser;
  if (!user) return null;
  
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified
  };
}

/**
 * Handles API responses
 * @param {Response} response - Fetch response
 * @returns {Promise<any>} - Parsed response data
 */
async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));
  
  if (!response.ok) {
    const error = new Error(data.message || 'API request failed');
    error.status = response.status;
    error.data = data;
    throw error;
  }
  
  return data;
}

/**
 * Makes an authenticated API request with Firebase token
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} - Response data
 */
async function request(endpoint, options = {}) {
  try {
    // Get Firebase token
    const token = await getFirebaseToken();
    
    // Set default headers
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };

    // Prepare fetch config
    const config = {
      ...options,
      headers,
      credentials: 'include',
      mode: 'cors',
      cache: 'no-cache',
    };

    // Make the request
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    return await handleResponse(response);
  } catch (error) {
    console.error(`API request to ${endpoint} failed:`, error);
    throw error;
  }
}

// Task-related API calls
const tasksAPI = {
    /**
     * Get all tasks
     * @returns {Promise<Array>} - Array of tasks
     */
    async getTasks() {
        if (!isLoggedIn()) {
            return JSON.parse(localStorage.getItem('guest_tasks') || '[]');
        }
        return await request('/tasks');
    },

    /**
     * Create a new task
     * @param {Object} task - Task data
     * @returns {Promise<Object>} - Created task
     */
    async createTask(task) {
        if (!isLoggedIn()) {
            const tasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
            const newTask = { ...task, id: Date.now().toString() };
            tasks.push(newTask);
            localStorage.setItem('guest_tasks', JSON.stringify(tasks));
            return newTask;
        }
        return await request('/tasks', {
            method: 'POST',
            body: JSON.stringify(task)
        });
    },

    /**
     * Update an existing task
     * @param {string} id - Task ID
     * @param {Object} updates - Task updates
     * @returns {Promise<Object>} - Updated task
     */
    async updateTask(id, updates) {
        if (!isLoggedIn()) {
            const tasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
            const index = tasks.findIndex(t => t.id === id);
            if (index !== -1) {
                tasks[index] = { ...tasks[index], ...updates };
                localStorage.setItem('guest_tasks', JSON.stringify(tasks));
                return tasks[index];
            }
            throw new Error('Task not found');
        }
        return await request(`/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    },

    /**
     * Delete a task
     * @param {string} id - Task ID
     * @returns {Promise<Object>} - Deletion result
     */
    async deleteTask(id) {
        if (!isLoggedIn()) {
            const tasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
            const filtered = tasks.filter(t => t.id !== id);
            localStorage.setItem('guest_tasks', JSON.stringify(filtered));
            return { success: true };
        }
        return await request(`/tasks/${id}`, {
            method: 'DELETE'
        });
    },

    /**
     * Sync guest tasks to the server after login
     * @returns {Promise<Array>} - Synced tasks
     */
    async syncGuestTasks() {
        if (!isLoggedIn()) {
            throw new Error('Must be logged in to sync tasks');
        }

        const guestTasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
        if (guestTasks.length === 0) {
            return [];
        }

        const syncedTasks = [];
        for (const task of guestTasks) {
            // Remove local ID and let server generate a new one
            const { id: _, ...taskData } = task;
            const syncedTask = await request('/tasks', {
                method: 'POST',
                body: JSON.stringify(taskData)
            });
            syncedTasks.push(syncedTask);
        }

        // Clear guest tasks after successful sync
        localStorage.removeItem('guest_tasks');
        return syncedTasks;
    }
};

// Auth-related API calls
const authAPI = {
    /**
     * Login user
     * @param {string} email 
     * @param {string} password 
     * @returns {Promise<Object>} - User data and token
     */
    async login(email, password) {
        try {
            const response = await fetch('https://yourskanban.onrender.com/api/auth/login', {
                method: 'POST',
                credentials: 'include', // Important for cookies
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await handleResponse(response);
            
            if (data.user) {
                // Store user data in localStorage (excluding sensitive info)
                const { password_hash, ...userData } = data.user;
                localStorage.setItem('user', JSON.stringify(userData));
                
                // Check if there are guest tasks to sync
                const guestTasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
                if (guestTasks.length > 0) {
                    try {
                        await tasksAPI.syncGuestTasks();
                    } catch (syncError) {
                        console.error('Failed to sync guest tasks:', syncError);
                    }
                }
                return userData;
            }
            throw new Error('No user data received from server');
        } catch (error) {
            console.error('Login error:', error);
            throw new Error(error.message || 'Login failed. Please check your credentials.');
        }
    },

    /**
     * Register new user
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>} - User data and token
     */
    async register(userData) {
        try {
            const response = await request('/auth/register', {
                method: 'POST',
                body: JSON.stringify(userData)
            });
            
            if (response.token) {
                localStorage.setItem('token', response.token);
                return response.user || {};
            }
            throw new Error('Registration failed. Please try again.');
        } catch (error) {
            console.error('Registration error:', error);
            throw new Error(error.message || 'Registration failed. Please try again.');
        }
    },

    /**
     * Logout user
     * @returns {Promise<boolean>} - Whether logout was successful
     */
    async logout() {
        try {
            localStorage.removeItem('token');
            // Optionally, make a backend call to invalidate the token
            // await request('/auth/logout', { method: 'POST' });
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    },

    /**
     * Get current user data
     * @returns {Promise<Object|null>} - User data or null if not authenticated
     */
    async getCurrentUser() {
        return getCurrentUser();
    }
};

// Export the API objects
export { tasksAPI, authAPI, isLoggedIn };

// Make them available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.tasksAPI = tasksAPI;
    window.authAPI = authAPI;
    window.isLoggedIn = isLoggedIn;
    window.getCurrentUser = getCurrentUser;
}
