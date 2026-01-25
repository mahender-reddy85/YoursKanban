/**
 * User Menu Dropdown Functionality
 * Handles the user avatar dropdown menu with user info and actions
 */

// Global state
let isDropdownOpen = false;
let dropdownMenu = null;
let dropdownBackdrop = null;

/**
 * Initialize the user menu functionality
 */
function initUserMenu() {
    // Get DOM elements
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.getElementById('userAvatar');
    dropdownMenu = document.getElementById('userDropdown');
    dropdownBackdrop = document.getElementById('dropdownBackdrop');

    // If elements don't exist, try again later
    if (!userMenu || !userAvatar || !dropdownMenu || !dropdownBackdrop) {
        console.warn('User menu elements not found, will retry...');
        setTimeout(initUserMenu, 100);
        return;
    }

    // Show the user menu
    userMenu.style.display = 'flex';

    // Add click handler to avatar
    userAvatar.addEventListener('click', toggleDropdown);
    
    // Add touch handlers for mobile
    userAvatar.addEventListener('touchstart', handleTouchStart, { passive: true });
    userAvatar.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Keyboard navigation
    userAvatar.setAttribute('tabindex', '0');
    userAvatar.setAttribute('role', 'button');
    userAvatar.setAttribute('aria-haspopup', 'true');
    userAvatar.setAttribute('aria-expanded', 'false');
    userAvatar.addEventListener('keydown', handleKeyDown);

    // Close when clicking outside
    document.addEventListener('click', handleClickOutside);
    
    // Close on escape key
    document.addEventListener('keydown', handleEscape);
    
    // Close when clicking backdrop
    dropdownBackdrop.addEventListener('click', closeDropdown);

    // Initialize user info
    initUserInfo();
}

// Touch handling variables
let touchStartY = 0;

function handleTouchStart(e) {
    touchStartY = e.touches[0].clientY;
}

function handleTouchEnd(e) {
    const touchEndY = e.changedTouches[0].clientY;
    // Only toggle if it's a tap (not a swipe)
    if (Math.abs(touchEndY - touchStartY) < 10) {
        e.preventDefault();
        toggleDropdown(e);
    }
}

function handleKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        toggleDropdown(e);
    } else if (e.key === 'Escape' && isDropdownOpen) {
        closeDropdown();
    }
}

function handleClickOutside(e) {
    const userAvatar = document.getElementById('userAvatar');
    if (isDropdownOpen && 
        !dropdownMenu.contains(e.target) && 
        e.target !== userAvatar) {
        closeDropdown();
    }
}

function handleEscape(e) {
    if (e.key === 'Escape' && isDropdownOpen) {
        closeDropdown();
    }
}

function toggleDropdown(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    if (isDropdownOpen) {
        closeDropdown();
    } else {
        openDropdown();
    }
}

function openDropdown() {
    if (isDropdownOpen || !dropdownMenu) return;
    
    const userAvatar = document.getElementById('userAvatar');
    const isMobile = window.innerWidth <= 768;
    
    // Position the dropdown
    if (isMobile) {
        dropdownMenu.classList.add('mobile');
    } else {
        dropdownMenu.classList.remove('mobile');
        const rect = userAvatar.getBoundingClientRect();
        dropdownMenu.style.top = `${rect.bottom + window.scrollY + 4}px`;
        dropdownMenu.style.right = `${window.innerWidth - rect.right}px`;
    }
    
    // Show the dropdown and backdrop
    dropdownMenu.classList.add('show');
    dropdownBackdrop.classList.add('show');
    isDropdownOpen = true;
    userAvatar.setAttribute('aria-expanded', 'true');
    
    // Focus first interactive element for keyboard users
    const firstFocusable = dropdownMenu.querySelector('button, a, [tabindex]');
    if (firstFocusable) {
        setTimeout(() => firstFocusable.focus(), 10);
    }
}

function closeDropdown() {
    if (!isDropdownOpen) return;
    
    dropdownMenu.classList.remove('show');
    dropdownBackdrop.classList.remove('show');
    isDropdownOpen = false;
    
    const userAvatar = document.getElementById('userAvatar');
    if (userAvatar) {
        userAvatar.setAttribute('aria-expanded', 'false');
        userAvatar.focus();
    }
}

function initUserInfo() {
    try {
        const userData = localStorage.getItem('user');
        if (userData) {
            const user = JSON.parse(userData);
            updateUserInfo(user);
        }
    } catch (e) {
        console.error('Error initializing user info:', e);
    }
}

function updateUserInfo(user) {
    if (!user) return;
    
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    const avatarInitials = document.getElementById('avatarInitials');
    const avatarInitialsLarge = document.getElementById('avatarInitialsLarge');
    
    // Get display name (fallback to email username if not available)
    let displayName = user.name || (user.email ? user.email.split('@')[0] : 'User');
    
    // Update name
    if (userNameEl) {
        userNameEl.textContent = displayName;
        userNameEl.setAttribute('aria-label', `Logged in as ${displayName}`);
    }
    
    // Update email
    if (userEmailEl) {
        const hasEmail = !!user.email;
        userEmailEl.textContent = user.email || 'No email provided';
        userEmailEl.style.display = hasEmail ? 'block' : 'none';
    }
    
    // Update avatar initials
    const initials = displayName.trim().charAt(0).toUpperCase();
    [avatarInitials, avatarInitialsLarge].forEach(el => {
        if (el) el.textContent = initials;
    });
}

// Handle logout with confirmation
async function handleLogout(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
    }
    
    // Create confirmation dialog
    const dialog = document.createElement('div');
    dialog.className = 'confirmation-dialog';
    dialog.innerHTML = `
        <div class="confirmation-content">
            <p>Are you sure you want to log out?</p>
            <div class="confirmation-buttons">
                <button id="confirmLogout" class="btn btn-danger">Logout</button>
                <button id="cancelLogout" class="btn btn-secondary">Cancel</button>
            </div>
        </div>
    `;

    // Add styles if not already added
    if (!document.getElementById('confirmation-styles')) {
        const style = document.createElement('style');
        style.id = 'confirmation-styles';
        style.textContent = `
            .confirmation-dialog {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 2000;
            }
            .confirmation-content {
                background: white;
                padding: 20px;
                border-radius: 8px;
                max-width: 90%;
                width: 400px;
                text-align: center;
            }
            .confirmation-buttons {
                display: flex;
                gap: 10px;
                justify-content: center;
                margin-top: 20px;
            }
            .btn {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
            }
            .btn-danger {
                background-color: #dc3545;
                color: white;
            }
            .btn-secondary {
                background-color: #6c757d;
                color: white;
            }
        `;
        document.head.appendChild(style);
    }

    // Show the dialog
    document.body.appendChild(dialog);
    document.body.style.overflow = 'hidden';

    // Handle dialog interactions
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('confirmLogout');
        const cancelBtn = document.getElementById('cancelLogout');

        const cleanup = () => {
            if (document.body.contains(dialog)) {
                document.body.removeChild(dialog);
            }
            document.body.style.overflow = '';
        };

        const handleConfirm = () => {
            cleanup();
            resolve(true);
        };

        const handleCancel = () => {
            cleanup();
            resolve(false);
        };

        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);

        // Handle escape key
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                handleCancel();
            }
        };
        document.addEventListener('keydown', handleKeyDown);

        // Handle click outside
        const handleOutsideClick = (e) => {
            if (e.target === dialog) {
                handleCancel();
            }
        };
        dialog.addEventListener('click', handleOutsideClick);

        // Cleanup function
        return () => {
            cleanup();
            confirmBtn.removeEventListener('click', handleConfirm);
            cancelBtn.removeEventListener('click', handleCancel);
            document.removeEventListener('keydown', handleKeyDown);
            dialog.removeEventListener('click', handleOutsideClick);
        };
    }).then(async (confirmed) => {
        if (confirmed) {
            try {
                if (window.firebaseAuth) {
                    await window.firebaseAuth.signOut();
                    // Clear any stored user data
                    localStorage.removeItem('user');
                    localStorage.removeItem('token');
                    window.location.href = '/';
                }
            } catch (error) {
                console.error('Logout error:', error);
                showToast('Failed to log out. Please try again.', 'error');
            }
        }
    });
}

// Show toast message
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Add toast styles if not already added
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 24px;
                border-radius: 4px;
                color: white;
                font-weight: 500;
                z-index: 2000;
                animation: slideIn 0.3s ease-out;
                max-width: 90%;
                text-align: center;
            }
            .toast.error {
                background-color: #dc3545;
            }
            .toast.success {
                background-color: #28a745;
            }
            .toast.info {
                background-color: #17a2b8;
            }
            @keyframes slideIn {
                from { transform: translate(-50%, 100%); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Remove toast after delay
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s ease-out';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUserMenu);
} else {
    // DOMContentLoaded has already fired
    initUserMenu();
}

// Make handleLogout globally available
window.handleLogout = handleLogout;