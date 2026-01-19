import { authAPI } from '../src/api.js';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const errorElement = document.getElementById('errorMessage');

// Redirect to dashboard if already logged in
const redirectIfAuthenticated = async () => {
  try {
    const user = await authAPI.getMe();
    if (user) {
      window.location.href = 'index.html';
    }
  } catch (error) {
    // Not authenticated, stay on login/register page
  }
};

// Show error message
const showError = (message) => {
  if (errorElement) {
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Hide error after 5 seconds
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }
};

// Handle login form submission
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = loginForm.email.value.trim();
    const password = loginForm.password.value;
    
    try {
      const response = await authAPI.login(email, password);
      if (response.token) {
        // Redirect to dashboard on successful login
        window.location.href = 'index.html';
      }
    } catch (error) {
      showError(error.message || 'Invalid email or password');
    }
  });
}

// Handle registration form submission
if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = registerForm.name.value.trim();
    const email = registerForm.email.value.trim();
    const password = registerForm.password.value;
    const confirmPassword = registerForm.confirmPassword.value;
    
    // Client-side validation
    if (password !== confirmPassword) {
      return showError('Passwords do not match');
    }
    
    if (password.length < 6) {
      return showError('Password must be at least 6 characters long');
    }
    
    try {
      await authAPI.register(name, email, password);
      
      // Auto-login after registration
      const loginResponse = await authAPI.login(email, password);
      if (loginResponse.token) {
        window.location.href = 'index.html';
      }
    } catch (error) {
      showError(error.message || 'Registration failed. Please try again.');
    }
  });
}

// Check authentication status on page load
document.addEventListener('DOMContentLoaded', () => {
  // Only redirect on auth pages
  if (window.location.pathname.includes('login.html') || 
      window.location.pathname.includes('register.html')) {
    redirectIfAuthenticated();
  }
});

// Logout functionality
const logout = () => {
  authAPI.logout();
};

// Make logout available globally if needed
window.auth = { logout };
