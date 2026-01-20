// User-related functionality
import { authAPI } from './api.js';

// Create backdrop element if it doesn't exist
let dropdownBackdrop = document.querySelector('.dropdown-backdrop');
if (!dropdownBackdrop) {
    dropdownBackdrop = document.createElement('div');
    dropdownBackdrop.className = 'dropdown-backdrop';
    document.body.appendChild(dropdownBackdrop);
}

// Check if device is mobile
const isMobile = () => window.innerWidth <= 768;

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
export function toggleDropdown(dropdown, backdrop) {
    const isOpen = dropdown.classList.contains('show');
    
    if (isOpen) {
        closeDropdown(dropdown, backdrop);
    } else {
        // Close any other open dropdowns
        document.querySelectorAll('.dropdown-menu.show').forEach(menu => {
            if (menu !== dropdown) {
                menu.classList.remove('show');
            }
        });
        
        openDropdown(dropdown, backdrop);
    }
}

/**
 * Opens the dropdown menu
 * @param {HTMLElement} dropdown - The dropdown menu element
 * @param {HTMLElement} backdrop - The backdrop element
 */
function openDropdown(dropdown, backdrop) {
    dropdown.classList.add('show');
    backdrop.classList.add('show');
    document.body.classList.add('dropdown-open');
    
    // Prevent body scrolling when dropdown is open on mobile
    if (isMobile()) {
        document.body.style.overflow = 'hidden';
    }
    
    // Position the dropdown
    positionDropdown(dropdown);
    
    // Add event listener to close on escape key
    document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Closes the dropdown menu
 * @param {HTMLElement} dropdown - The dropdown menu element
 * @param {HTMLElement} backdrop - The backdrop element
 */
function closeDropdown(dropdown, backdrop) {
    dropdown.classList.remove('show');
    backdrop.classList.remove('show');
    document.body.classList.remove('dropdown-open');
    
    // Re-enable body scrolling
    document.body.style.overflow = '';
    
    // Remove event listener
    document.removeEventListener('keydown', handleEscapeKey);
}

/**
 * Handles the escape key press
 * @param {KeyboardEvent} e - The keyboard event
 */
function handleEscapeKey(e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
        const dropdown = document.querySelector('.dropdown-menu.show');
        const backdrop = document.querySelector('.dropdown-backdrop.show');
        if (dropdown && backdrop) {
            closeDropdown(dropdown, backdrop);
        }
    }
}

/**
 * Positions the dropdown menu properly
 * @param {HTMLElement} dropdown - The dropdown menu element
 */
function positionDropdown(dropdown) {
    if (isMobile()) {
        // For mobile, we use fixed positioning with bottom: 0
        dropdown.style.top = 'auto';
        dropdown.style.bottom = '0';
        dropdown.style.left = '0';
        dropdown.style.right = '0';
        dropdown.style.width = '100%';
        dropdown.style.maxWidth = '100%';
        dropdown.style.borderRadius = '16px 16px 0 0';
        dropdown.style.transform = 'translateY(100%)';
        
        // Trigger reflow to ensure the transform is applied before showing
        void dropdown.offsetHeight;
        
        // Add a small delay to ensure the transform is applied before showing
        requestAnimationFrame(() => {
            dropdown.style.transform = 'translateY(0)';
        });
    } else {
        // For desktop, position below the avatar
        const avatar = document.querySelector('.avatar-container');
        if (avatar) {
            const avatarRect = avatar.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            const dropdownHeight = dropdown.offsetHeight;
            
            // Position below the avatar
            dropdown.style.top = `${avatarRect.bottom + window.scrollY + 8}px`;
            dropdown.style.right = `${window.innerWidth - (avatarRect.right + window.scrollX)}px`;
            
            // Check if dropdown would go off the bottom of the screen
            if (avatarRect.bottom + dropdownHeight > viewportHeight) {
                // Position above the avatar
                dropdown.style.top = 'auto';
                dropdown.style.bottom = `${viewportHeight - avatarRect.top + window.scrollY - 8}px`;
            }
            
            // Ensure dropdown stays within viewport
            const dropdownRect = dropdown.getBoundingClientRect();
            if (dropdownRect.right > window.innerWidth) {
                dropdown.style.right = '8px';
            }
            if (dropdownRect.left < 0) {
                dropdown.style.left = '8px';
                dropdown.style.right = 'auto';
            }
        }
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
    
    // Toggle dropdown menu on avatar click/tap
    const toggleMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleDropdown(dropdownMenu, dropdownBackdrop);
    };
    
    // Add both touch and click events for better mobile support
    userAvatar.addEventListener('click', toggleMenu);
    userAvatar.addEventListener('touchend', toggleMenu);
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userMenu.contains(e.target)) {
            dropdownMenu.classList.remove('show');
            dropdownBackdrop.classList.remove('show');
            document.body.classList.remove('dropdown-open');
        }
    });
    
    // Close on backdrop click
    dropdownBackdrop.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDropdown(dropdownMenu, dropdownBackdrop);
    });
    
    // Prevent clicks inside dropdown from closing it
    dropdownMenu.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // Handle logout
    if (logoutBtn) {
        const handleLogout = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
                closeDropdown(dropdownMenu, dropdownBackdrop);
                await authAPI.logout();
                updateUserAvatar(null);
                // Instead of redirecting to /login, just reload the page
                // which will show the login form since the user is logged out
                window.location.reload();
            } catch (error) {
                console.error('Logout failed:', error);
            }
        };
        
        // Add both touch and click events for better mobile support
        logoutBtn.addEventListener('click', handleLogout);
        logoutBtn.addEventListener('touchend', handleLogout);
    }
    
    // Handle My Tasks click
    if (myTasksBtn) {
        const handleMyTasks = (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeDropdown(dropdownMenu, dropdownBackdrop);
            
            // Filter tasks to show only user's tasks
            // This will depend on your task filtering implementation
            console.log('Show my tasks');
            // You can implement task filtering here
        };
        
        // Add both touch and click events for better mobile support
        myTasksBtn.addEventListener('click', handleMyTasks);
        myTasksBtn.addEventListener('touchend', handleMyTasks);
    }
    
    // Handle window resize
    let resizeTimer;
    const handleResize = () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (dropdownMenu.classList.contains('show')) {
                positionDropdown(dropdownMenu);
            }
        }, 100);
    };
    
    // Use both resize and orientationchange for better mobile support
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // Cleanup event listeners when the component is destroyed
    return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('orientationchange', handleResize);
        document.removeEventListener('keydown', handleEscapeKey);
    };
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
    
    // Initialize user menu
    initUserMenu();
});
