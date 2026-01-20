// User-related functionality
import { authAPI } from './api.js';

/**
 * Updates the user avatar in the UI
 * @param {Object} user - User object containing name and email
 */
export function updateUserAvatar(user) {
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.querySelector('#userAvatar .avatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    
    if (user) {
        // Show user menu and hide auth buttons
        document.body.classList.add('user-logged-in');
        userMenu.style.display = 'flex';
        
        // Set user info
        const firstName = user.name ? user.name.split(' ')[0] : 'U';
        const firstLetter = firstName.charAt(0).toUpperCase();
        
        userAvatar.textContent = firstLetter;
        userName.textContent = user.name || 'User';
        userEmail.textContent = user.email || '';
        
        // Set random background color for avatar
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        const color = colors[Math.floor(Math.random() * colors.length)];
        userAvatar.style.backgroundColor = color;
    } else {
        // Hide user menu and show auth buttons
        document.body.classList.remove('user-logged-in');
        userMenu.style.display = 'none';
    }
}

/**
 * Initializes user menu functionality
 */
export function initUserMenu() {
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.getElementById('userAvatar');
    const dropdownMenu = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    const myTasksBtn = document.getElementById('myTasksBtn');
    
    // Toggle dropdown menu
    userAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target)) {
            dropdownMenu.classList.remove('show');
        }
    });
    
    // Handle logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await authAPI.logout();
                updateUserAvatar(null);
                window.location.href = '/login';
            } catch (error) {
                console.error('Logout failed:', error);
            }
        });
    }
    
    // Handle My Tasks click
    if (myTasksBtn) {
        myTasksBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Filter tasks to show only user's tasks
            // This will depend on your task filtering implementation
            console.log('Show my tasks');
            // You can implement task filtering here
        });
    }
}

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const user = await authAPI.getCurrentUser();
        if (user) {
            updateUserAvatar(user);
        }
    } catch (error) {
        console.error('Error checking user authentication:', error);
    }
});
