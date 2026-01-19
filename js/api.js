const API_BASE_URL = 'https://yourskanban.onrender.com/api';

// Helper function to handle API responses
async function handleResponse(response) {
    const data = await response.json().catch(() => ({}));
    
    if (!response.ok) {
        let errorMessage = data.message || 'An error occurred';
        
        if (response.status === 401) {
            errorMessage = 'Session expired. Please log in again.';
            // Clear invalid token
            localStorage.removeItem('token');
            // Redirect to login or show login modal
            window.location.href = '/login';
        } else if (response.status === 403) {
            errorMessage = 'You do not have permission to perform this action.';
        } else if (response.status === 404) {
            errorMessage = 'The requested resource was not found.';
        } else if (response.status >= 500) {
            errorMessage = 'A server error occurred. Please try again later.';
        }
        
        const error = new Error(errorMessage);
        error.status = response.status;
        error.data = data;
        throw error;
    }
    
    return data;
}

// Auth API
export const authAPI = {
    async login(email, password) {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });
        
        const data = await handleResponse(response);
        
        // Store the token in localStorage if it exists in the response
        if (data.token) {
            localStorage.setItem('token', data.token);
        }
        
        return data;
    },

    async register(name, email, password) {
        const response = await fetch(`${API_BASE_URL}/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name, email, password }),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    async getCurrentUser() {
        // Get token from localStorage
        const token = localStorage.getItem('token');
        
        const headers = {
            'Content-Type': 'application/json',
        };

        // Add Authorization header if token exists
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}/me`, {
            headers,
            credentials: 'include'
        });
        
        return handleResponse(response);
    },

    logout() {
        return fetch(`${API_BASE_URL}/logout`, {
            method: 'POST',
            credentials: 'include'
        });
    }
};

// Helper function to get headers with auth token
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    return headers;
}

// Tasks API
export const tasksAPI = {
    async getAll() {
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    async getById(id) {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    async create(task) {
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(task),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    async update(id, task) {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(task),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    async delete(id) {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    async updateStatus(id, status) {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status }),
            credentials: 'include'
        });
        return handleResponse(response);
    }
};

// File Upload API
export const fileAPI = {
    async upload(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        return handleResponse(response);
    }
};
