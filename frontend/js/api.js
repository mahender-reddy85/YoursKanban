// API Utility Functions

/**
 * Makes an authenticated API request
 * @param {string} endpoint - API endpoint
 * @param {Object} options - Fetch options
 * @returns {Promise<any>} - Response data
 */
async function request(endpoint, options = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers
    };

    try {
        const response = await fetch(`/api${endpoint}`, config);
        return await handleResponse(response);
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

/**
 * Handles API response
 * @param {Response} response - Fetch response
 * @returns {Promise<any>} - Response data
 */
async function handleResponse(response) {
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
        if (response.status === 401) {
            const token = localStorage.getItem('token');
            if (token) {
                localStorage.removeItem('token');
                throw new Error('Session expired. Please log in again.');
            }
            throw new Error('Not logged in.');
        }
        
        const error = new Error(data.message || 'Something went wrong');
        error.status = response.status;
        throw error;
    }
    
    return data;
}

/**
 * Checks if user is logged in
 * @returns {boolean} - True if user is logged in
 */
export function isLoggedIn() {
    return !!localStorage.getItem('token');
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
        const response = await request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (response.token) {
            localStorage.setItem('token', response.token);
            // Check if there are guest tasks to sync
            const guestTasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
            if (guestTasks.length > 0) {
                // Show sync dialog
                const sync = confirm('Do you want to sync your guest tasks to your account?');
                if (sync) {
                    try {
                        await tasksAPI.syncGuestTasks();
                        alert('Your tasks have been synced successfully!');
                    } catch (error) {
                        console.error('Failed to sync tasks:', error);
                        alert('Failed to sync tasks. Please try again later.');
                    }
                }
            }
        }
        
        return response;
    },

    /**
     * Register new user
     * @param {Object} userData - User registration data
     * @returns {Promise<Object>} - User data and token
     */
    async register(userData) {
        const response = await request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        
        if (response.token) {
            localStorage.setItem('token', response.token);
            // No need to sync guest tasks on register as it's a new account
        }
        
        return response;
    },

    /**
     * Logout user
     */
    logout() {
        localStorage.removeItem('token');
    },

    /**
     * Get current user data
     * @returns {Promise<Object>} - User data
     */
    async getCurrentUser() {
        if (!isLoggedIn()) {
            return null;
        }
        return await request('/auth/me');
    }
};

export { tasksAPI, authAPI, isLoggedIn };
