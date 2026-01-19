import { authAPI } from './api.js';
import { state } from './state.js';

export const Auth = {
    // Check if user is authenticated
    async checkAuth() {
        try {
            const user = await authAPI.getCurrentUser();
            state.currentUser = user;
            state.isAuthenticated = true;
            updateAuthUI(true);
            return true;
        } catch (error) {
            state.currentUser = null;
            state.isAuthenticated = false;
            updateAuthUI(false);
            return false;
        }
    },

    // Handle login
    async login(email, password) {
        try {
            const user = await authAPI.login(email, password);
            state.currentUser = user;
            state.isAuthenticated = true;
            updateAuthUI(true);
            showToast('Login successful', 'success');
            return true;
        } catch (error) {
            console.error('Login failed:', error);
            showToast(error.message || 'Login failed', 'error');
            throw error;
        }
    },

    // Handle registration
    async register(name, email, password) {
        try {
            const user = await authAPI.register(name, email, password);
            state.currentUser = user;
            state.isAuthenticated = true;
            updateAuthUI(true);
            showToast('Registration successful', 'success');
            return true;
        } catch (error) {
            console.error('Registration failed:', error);
            showToast(error.message || 'Registration failed', 'error');
            throw error;
        }
    },

    // Handle logout
    async logout() {
        try {
            await authAPI.logout();
            state.currentUser = null;
            state.isAuthenticated = false;
            updateAuthUI(false);
            showToast('Logged out successfully', 'success');
            // Redirect to login or home page
            window.location.href = '/login.html';
        } catch (error) {
            console.error('Logout failed:', error);
            showToast('Logout failed', 'error');
        }
    }
};

// Update UI based on authentication state
function updateAuthUI(isAuthenticated) {
    const authButton = document.getElementById('authButton');
    const userMenu = document.getElementById('userMenu');
    const loginModal = document.getElementById('loginModal');
    const registerModal = document.getElementById('registerModal');

    if (isAuthenticated) {
        // Update auth button to show user info
        if (authButton) {
            authButton.innerHTML = `
                <i class="fas fa-user-circle"></i>
                <span>${state.currentUser?.name || 'User'}</span>
            `;
            authButton.onclick = () => {
                // Toggle user menu or show profile
                if (userMenu) {
                    userMenu.style.display = userMenu.style.display === 'block' ? 'none' : 'block';
                }
            };
        }

        // Close any open auth modals
        if (loginModal) loginModal.style.display = 'none';
        if (registerModal) registerModal.style.display = 'none';
    } else {
        // Update auth button to show login/signup
        if (authButton) {
            authButton.innerHTML = `
                <i class="fas fa-sign-in-alt"></i>
                <span>Login / Sign Up</span>
            `;
            authButton.onclick = () => {
                if (loginModal) loginModal.style.display = 'flex';
            };
        }
    }

    // Show/hide user menu
    if (userMenu) {
        userMenu.style.display = isAuthenticated ? 'none' : 'none';
    }
}

// Initialize authentication when the page loads
document.addEventListener('DOMContentLoaded', () => {
    // Check authentication status
    Auth.checkAuth();

    // Set up login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = loginForm.elements['email'].value;
            const password = loginForm.elements['password'].value;
            
            try {
                await Auth.login(email, password);
                // Redirect to the main app or reload
                window.location.href = '/';
            } catch (error) {
                // Error is already handled in the login function
            }
        });
    }

    // Set up registration form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = registerForm.elements['name'].value;
            const email = registerForm.elements['email'].value;
            const password = registerForm.elements['password'].value;
            
            try {
                await Auth.register(name, email, password);
                // Redirect to the main app or show success message
                window.location.href = '/';
            } catch (error) {
                // Error is already handled in the register function
            }
        });
    }

    // Set up logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            Auth.logout();
        });
    }

    // Toggle between login and register forms
    const showLoginLink = document.getElementById('showLogin');
    const showRegisterLink = document.getElementById('showRegister');
    
    if (showLoginLink) {
        showLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (loginModal) loginModal.style.display = 'flex';
            if (registerModal) registerModal.style.display = 'none';
        });
    }
    
    if (showRegisterLink) {
        showRegisterLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (registerModal) registerModal.style.display = 'flex';
            if (loginModal) loginModal.style.display = 'none';
        });
    }
});
