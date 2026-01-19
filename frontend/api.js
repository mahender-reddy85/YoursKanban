const API_BASE_URL = 'https://yourskanban.onrender.com/api';

// Helper function to handle API responses
async function handleResponse(response) {
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Something went wrong');
    }
    return response.json();
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
        return handleResponse(response);
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
        const response = await fetch(`${API_BASE_URL}/me`, {
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

// Tasks API
export const tasksAPI = {
    async getAll() {
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            credentials: 'include'
        });
        return handleResponse(response);
    },

    async getById(id) {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            credentials: 'include'
        });
        return handleResponse(response);
    },

    async create(task) {
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(task),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    async update(id, task) {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(task),
            credentials: 'include'
        });
        return handleResponse(response);
    },

    async delete(id) {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        return handleResponse(response);
    },

    async updateStatus(id, status) {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
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
