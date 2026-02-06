// API Utility Functions
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const auth = getAuth();
const API_BASE = "https://yourskanban.onrender.com/api";

// Track if we're currently refreshing the token
let isRefreshing = false;
let refreshPromise = null;

/**
 * Get the current user's ID token, with automatic refresh
 * @returns {Promise<string|null>} - Fresh ID token or null if not authenticated
 */
async function getFirebaseToken() {
  const user = auth.currentUser;
  if (!user) {
    return null;
  }

  // Check if we're already refreshing the token
  if (isRefreshing) {
    return refreshPromise;
  }

  try {
    isRefreshing = true;
    refreshPromise = (async () => {
      const token = await user.getIdToken(true); // Force refresh
      return token;
    })();

    return await refreshPromise;
  } catch (error) {
    console.error('Error refreshing token:', error.message);
    throw error;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Force token refresh when auth state changes
    getFirebaseToken().catch(err => console.error('Token refresh failed:', err.message));
  }
});

/**
 * Check if user is logged in using Firebase Auth
 * @returns {boolean} - True if user is logged in
 */
function isLoggedIn() {
    return auth.currentUser !== null;
}

/**
 * Get current user from Firebase Auth
 * @returns {Object|null} - Current user object or null if not logged in
 */
function getCurrentUser() {
    const user = auth.currentUser;
    if (!user) return null;
    
    return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        emailVerified: user.emailVerified,
        photoURL: user.photoURL,
        // Add any other user properties you need
    };
}


/**
 * Makes an authenticated API request with Firebase token
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} - Response data
 */
async function request(endpoint, options = {}, retryCount = 0) {
  const startTime = Date.now();
  const MAX_RETRIES = 1; // Maximum number of retry attempts
  
  try {
    // Get the current user
    const user = auth.currentUser;
    if (!user && !endpoint.includes('/public/')) {
      const error = new Error('Authentication required');
      error.code = 'AUTH_REQUIRED';
      throw error;
    }
    
    // Get a fresh token for each request
    const token = user ? await user.getIdToken(true) : null;
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(options.headers || {})
    };
    
    // Make the request
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include' // Include cookies if needed
    });
    
    // Handle 401 Unauthorized with token refresh and retry
    if (response.status === 401) {
      if (retryCount < MAX_RETRIES) {
        // Force token refresh
        if (user) {
          await user.getIdToken(true); // Force refresh
        }
        
        // Retry the request with the new token
        return request(endpoint, options, retryCount + 1);
      }
      
      // If we've already retried, throw an error
      const error = new Error('Session expired. Please log in again.');
      error.code = 'SESSION_EXPIRED';
      error.status = 401;
      throw error;
    }
    
    return await handleResponse(response);
  } catch (error) {
    // Handle specific error cases
    if (error.code === 'AUTH_REQUIRED') {
      throw new Error('Please sign in to continue');
    }
    
    if (error.code === 'SESSION_EXPIRED') {
      throw new Error('Your session has expired. Please log in again.');
    }
    
    if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your connection.');
    }
    
    if (error.message.includes('auth/network-request-failed')) {
      throw new Error('Unable to connect to authentication service');
    }
    
    if (error.message.includes('auth/too-many-requests')) {
      throw new Error('Too many requests. Please try again later.');
    }
    
    throw error;
  }
}

/**
 * Handles API responses with better error handling
 * @param {Response} response - Fetch response
 * @returns {Promise<any>} - Parsed response data
 */
async function handleResponse(response) {
  let data;
  try {
    data = await response.json();
  } catch (error) {
    data = {};
  }
  
  if (!response.ok) {
    const error = new Error(data.message || 'API request failed');
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    throw error;
  }
  
  return data;
}

// Task-related API calls
const tasksAPI = {
    /**
     * Get all tasks
     * @returns {Promise<Array>} - Array of tasks
     */
    async getTasks() {
        try {
            console.log('Getting tasks...');
            
            if (!isLoggedIn()) {
                const guestTasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
                return { success: true, data: guestTasks };
            }
            
            const response = await request('/v1/tasks', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            });
            
            return response.data || [];
        } catch (error) {
            console.error('Error in getTasks:', error.message);
            throw error;
        }
    },

    /**
     * Create a new task
     * @param {Object} task - Task data
     * @returns {Promise<Object>} - Created task
     */
    async createTask(task) {
        if (!isLoggedIn()) {
            const tasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
            const newTask = { 
                ...task, 
                id: `guest-${Date.now()}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                subtasks: []
            };
            tasks.push(newTask);
            localStorage.setItem('guest_tasks', JSON.stringify(tasks));
            return { success: true, data: newTask };
        }
        const response = await request('/v1/tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(task)
        });
        return response.data;
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
                const updatedTask = { 
                    ...tasks[index], 
                    ...updates,
                    updated_at: new Date().toISOString()
                };
                tasks[index] = updatedTask;
                localStorage.setItem('guest_tasks', JSON.stringify(tasks));
                return { success: true, data: updatedTask };
            }
            throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
        }
        const response = await request(`/v1/tasks/${id}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        return response.data;
    },

    /**
     * Delete a task
     * @param {string} id - Task ID
     * @returns {Promise<Object>} - Deletion result
     */
    async deleteTask(id) {
        if (!isLoggedIn()) {
            let tasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
            const initialLength = tasks.length;
            tasks = tasks.filter(t => t.id !== id);
            
            if (tasks.length === initialLength) {
                throw new AppError('Task not found', 404, 'TASK_NOT_FOUND');
            }
            
            localStorage.setItem('guest_tasks', JSON.stringify(tasks));
            return { success: true };
        }
        
        const response = await request(`/v1/tasks/${id}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json'
            }
        });
        
        return { success: true };
    },

    /**
     * Sync guest tasks to the server after login
     * @returns {Promise<Array>} - Synced tasks
     */
    async syncGuestTasks() {
        const guestTasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
        if (!guestTasks.length) return [];

        const syncedTasks = [];
        for (const task of guestTasks) {
            try {
                // Remove client-side only fields
                const { id, created_at, updated_at, ...taskData } = task;
                const response = await this.createTask(taskData);
                if (response && response.id) {
                    syncedTasks.push(response);
                }
            } catch (error) {
                console.error('Error syncing task:', {
                    taskId: task.id,
                    error: error.message,
                    code: error.code
                });
            }
        }

        // Clear guest tasks after successful sync
        localStorage.removeItem('guest_tasks');
        return syncedTasks;
    }
};

// Auth-related API calls
const authAPI = {
  /**
   * Login user with Firebase
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<UserCredential>} - Firebase UserCredential
   */
  login(email, password) {
    return signInWithEmailAndPassword(auth, email, password);
  },

  /**
   * Register new user with Firebase
   * @param {string} email 
   * @param {string} password 
   * @returns {Promise<UserCredential>} - Firebase UserCredential
   */
  register(email, password) {
    return createUserWithEmailAndPassword(auth, email, password);
  },

  /**
   * Logout user
   * @returns {Promise<void>}
   */
  logout() {
    return signOut(auth);
  },

  /**
   * Get current user
   * @returns {User|null} - Current Firebase user or null if not authenticated
   */
  getCurrentUser() {
    return auth.currentUser;
  },

  /**
   * Listen for auth state changes
   * @param {Function} callback - Callback function that receives the user object
   * @returns {Function} - Unsubscribe function
   */
  onAuthStateChanged(callback) {
    return onAuthStateChanged(auth, callback);
  }
};

// Export the API objects and utility functions
export { 
  tasksAPI, 
  authAPI, 
  isLoggedIn, 
  getCurrentUser 
};

// Make them available globally for backward compatibility
if (typeof window !== 'undefined') {
    window.tasksAPI = tasksAPI;
    window.authAPI = authAPI;
    window.isLoggedIn = isLoggedIn;
    window.getCurrentUser = getCurrentUser;
}
