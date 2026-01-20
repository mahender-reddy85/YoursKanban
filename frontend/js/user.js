// User-related functionality
import { authAPI } from './api.js';

// Create backdrop element
const dropdownBackdrop = document.createElement('div');
dropdownBackdrop.className = 'dropdown-backdrop';
document.body.appendChild(dropdownBackdrop);

/**
 * Updates the user avatar in the UI
 * @param {Object} user - User object containing name and email
 */
export function updateUserAvatar(user) {
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.querySelector('#userAvatar .avatar') || document.querySelector('#userAvatar');
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
        if (userName) userName.textContent = user.name || 'User';
        if (userEmail) userEmail.textContent = user.email || '';
        
        // Set random background color for avatar if not already set
        if (!userAvatar.style.backgroundColor) {
            const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
            const color = colors[Math.floor(Math.random() * colors.length)];
            userAvatar.style.backgroundColor = color;
        }
    } else {
        // Hide user menu and show auth buttons
        document.body.classList.remove('user-logged-in');
        userMenu.style.display = 'none';
    }
}

/**
 * Toggles the dropdown menu and backdrop
 * @param {HTMLElement} dropdown - The dropdown menu element
 * @param {HTMLElement} backdrop - The backdrop element
 */
function toggleDropdown(dropdown, backdrop) {
    const isOpen = dropdown.classList.contains('show');
    
    if (isOpen) {
        dropdown.classList.remove('show');
        backdrop.classList.remove('show');
        document.body.classList.remove('dropdown-open');
    } else {
        // Close any other open dropdowns
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            if (menu !== dropdown) {
                menu.classList.remove('show');
            }
        });
        
        dropdown.classList.add('show');
        backdrop.classList.add('show');
        document.body.classList.add('dropdown-open');
        
        // Position the dropdown
        positionDropdown(dropdown);
    }
}

/**
 * Positions the dropdown menu properly
 * @param {HTMLElement} dropdown - The dropdown menu element
 */
function positionDropdown(dropdown) {
    const rect = dropdown.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // If dropdown is going off the bottom of the screen
    if (rect.bottom > viewportHeight) {
        dropdown.style.top = 'auto';
        dropdown.style.bottom = '100%';
        dropdown.style.marginBottom = '8px';
    } else {
        dropdown.style.top = 'calc(100% + 8px)';
        dropdown.style.bottom = 'auto';
        dropdown.style.marginBottom = '0';
    }
}

/**
 * Initializes user menu functionality
 */
export function initUserMenu() {
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.querySelector('#userAvatar') || document.querySelector('.avatar-container');
    const dropdownMenu = document.getElementById('userDropdown');
    const logoutBtn = document.getElementById('logoutBtn');
    const myTasksBtn = document.getElementById('myTasksBtn');
    
    if (!userMenu || !userAvatar || !dropdownMenu) return;
    
    // Toggle dropdown menu on avatar click
    userAvatar.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDropdown(dropdownMenu, dropdownBackdrop);
    });
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target)) {
            dropdownMenu.classList.remove('show');
            dropdownBackdrop.classList.remove('show');
            document.body.classList.remove('dropdown-open');
        }
    });
    
    // Close on backdrop click
    dropdownBackdrop.addEventListener('click', () => {
        dropdownMenu.classList.remove('show');
        dropdownBackdrop.classList.remove('show');
        document.body.classList.remove('dropdown-open');
    });
    
    // Handle logout
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            try {
                await authAPI.logout();
                updateUserAvatar(null);
                // Instead of redirecting to /login, just reload the page
                // which will show the login form since the user is logged out
                window.location.reload();
            } catch (error) {
                console.error('Logout failed:', error);
            }
        });
    }
    
    // Handle My Tasks click
    if (myTasksBtn) {
        myTasksBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // Close the dropdown
            dropdownMenu.classList.remove('show');
            dropdownBackdrop.classList.remove('show');
            document.body.classList.remove('dropdown-open');
            
            // Filter tasks to show only user's tasks
            // This will depend on your task filtering implementation
            console.log('Show my tasks');
            // You can implement task filtering here
        });
    }
    
    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (dropdownMenu.classList.contains('show')) {
                positionDropdown(dropdownMenu);
            }
        }, 250);
    });
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
