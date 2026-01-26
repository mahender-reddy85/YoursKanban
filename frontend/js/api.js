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
    console.log('🔴 No authenticated user');
    return null;
  }

  // Check if we're already refreshing the token
  if (isRefreshing) {
    console.log('🔄 Token refresh in progress, waiting...');
    return refreshPromise;
  }

  try {
    isRefreshing = true;
    refreshPromise = (async () => {
      console.log('🔄 Getting fresh ID token...');
      const token = await user.getIdToken(true); // Force refresh
      console.log('✅ Got fresh token (first 30 chars):', token.substring(0, 30) + '...');
      console.log('📏 Token length:', token.length);
      return token;
    })();

    return await refreshPromise;
  } catch (error) {
    console.error('❌ Error refreshing token:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
}

// Listen for auth state changes
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('👤 Auth state changed - User signed in:', user.uid);
    // Force token refresh when auth state changes
    getFirebaseToken().catch(console.error);
  } else {
    console.log('👤 Auth state changed - No user signed in');
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
async function request(endpoint, options = {}) {
  const requestId = Math.random().toString(36).substring(2, 8);
  const startTime = Date.now();
  
  const log = (message, data) => {
    console.log(`[${requestId}] ${message}`, data || '');
  };
  
  const logError = (message, error) => {
    console.error(`[${requestId}] ❌ ${message}`, {
      error: error?.message || error,
      code: error?.code,
      stack: error?.stack
    });
  };
  
  try {
    log(`📡 Starting ${options.method || 'GET'} request to ${endpoint}`);
    
    // Get a fresh token for each request
    const token = await getFirebaseToken();
    
    if (!token && !endpoint.includes('/public/')) {
      const error = new Error('Authentication required');
      error.code = 'AUTH_REQUIRED';
      throw error;
    }
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(options.headers || {})
    };
    
    log('Request headers:', {
      'Content-Type': headers['Content-Type'],
      'Authorization': headers['Authorization'] ? 'Bearer [TOKEN]' : 'None'
    });
    
    // Make the request
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include' // Include cookies if needed
    });
    
    const responseTime = Date.now() - startTime;
    log(`↩️ Response received in ${responseTime}ms`, {
      status: response.status,
      statusText: response.statusText
    });
    
    // Handle 401 Unauthorized with token refresh
    if (response.status === 401) {
      log('🔄 Received 401, attempting token refresh...');
      const newToken = await getFirebaseToken();
      
      if (newToken && newToken !== token) {
        log('🆕 Got new token, retrying request...');
        const retryResponse = await fetch(`${API_BASE}${endpoint}`, {
          ...options,
          headers: {
            ...headers,
            'Authorization': `Bearer ${newToken}`
          }
        });
        return await handleResponse(retryResponse, requestId);
      }
      
      const error = new Error('Session expired. Please log in again.');
      error.code = 'SESSION_EXPIRED';
      throw error;
    }
    
    return await handleResponse(response, requestId);
  } catch (error) {
    logError('Request failed', error);
    
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
    
    // Add more specific error handling as needed
    
    // For other errors, include the request ID in the error message
    const enhancedError = new Error(`${error.message} (Request ID: ${requestId})`);
    enhancedError.originalError = error;
    enhancedError.requestId = requestId;
    throw enhancedError;
  }
}

/**
 * Handles API responses with better error handling
 * @param {Response} response - Fetch response
 * @param {string} requestId - Unique ID for the request
 * @returns {Promise<any>} - Parsed response data
 */
async function handleResponse(response, requestId = '') {
  const log = (message, data) => {
    const prefix = requestId ? `[${requestId}] ` : '';
    console.log(`${prefix}${message}`, data || '');
  };
  
  let data;
  try {
    data = await response.json();
  } catch (error) {
    log('⚠️ Failed to parse JSON response');
    data = {};
  }
  
  if (!response.ok) {
    const error = new Error(data.message || 'API request failed');
    error.status = response.status;
    error.code = data.code;
    error.data = data;
    error.requestId = requestId;
    
    log('❌ API Error:', {
      status: response.status,
      code: data.code,
      message: data.message
    });
    
    throw error;
  }
  
  log('✅ Request successful');
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
                console.log('User not logged in, returning guest tasks');
                return JSON.parse(localStorage.getItem('guest_tasks') || '[]');
            }
            
            const response = await request('/tasks', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Tasks retrieved successfully');
            return response;
        } catch (error) {
            console.error('Error in getTasks:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
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
