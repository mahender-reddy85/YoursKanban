/**
 * User Menu Dropdown Functionality
 * Handles the user avatar dropdown menu with user info and actions
 */

/**
 * Handle logout action with custom confirmation dialog
 */
async function handleLogout(e) {
    // Prevent default behavior (form submission, link navigation, etc.)
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
                backdrop-filter: blur(2px);
            }
            .confirmation-content {
                background: white;
                padding: 20px;
                border-radius: 8px;
                max-width: 90%;
                width: 400px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                text-align: center;
            }
            .confirmation-content p {
                margin-bottom: 20px;
                font-size: 16px;
                color: #333;
            }
            .confirmation-buttons {
                display: flex;
                gap: 12px;
                justify-content: center;
            }
            .confirmation-buttons button {
                padding: 8px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
                transition: all 0.2s;
            }
            .confirmation-buttons button:hover {
                opacity: 0.9;
            }
            #confirmLogout {
                background-color: #dc3545;
                color: white;
            }
            #cancelLogout {
                background-color: #6c757d;
                color: white;
            }
        `;
        document.head.appendChild(style);
    }

    // Show the dialog
    document.body.appendChild(dialog);
    document.body.style.overflow = 'hidden'; // Prevent scrolling when dialog is open

    // Handle button clicks
    return new Promise((resolve) => {
        const confirmBtn = document.getElementById('confirmLogout');
        const cancelBtn = document.getElementById('cancelLogout');

        const cleanup = () => {
            document.body.removeChild(dialog);
            document.body.style.overflow = '';
            document.removeEventListener('keydown', handleEscape);
        };

        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                cleanup();
                resolve(false);
            }
        };
        
        confirmBtn.onclick = () => {
            cleanup();
            resolve(true);
        };
        
        cancelBtn.onclick = () => {
            cleanup();
            resolve(false);
        };
        
        document.addEventListener('keydown', handleEscape);
        
        // Handle click outside the dialog
        dialog.onclick = (e) => {
            if (e.target === dialog) {
                cleanup();
                resolve(false);
            }
        };
    }).then(async (confirmed) => {
        if (confirmed) {
            try {
                // Sign out from Firebase
                if (window.firebaseAuth) {
                    await window.firebaseAuth.signOut();
                    showToast('Logged out successfully', 'success');
                    
                    // Close dropdown if open
                    const dropdown = document.getElementById('userDropdown');
                    if (dropdown) {
                        dropdown.classList.remove('show');
                    }

                    // Redirect to home page after a short delay
                    setTimeout(() => {
                        window.location.href = '/';
                    }, 500);
                }
            } catch (error) {
                console.error('Logout error:', error);
                showToast('Error logging out. Please try again.', 'error');
            }
        }
    });
}

// Make handleLogout globally available
window.handleLogout = handleLogout;

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.getElementById('userAvatar');
    const dropdownMenu = document.getElementById('userDropdown');
    const dropdownBackdrop = document.createElement('div');
    dropdownBackdrop.id = 'dropdownBackdrop';
    document.body.appendChild(dropdownBackdrop);
    
    const myTasksBtn = document.getElementById('myTasksBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    const avatarInitials = document.getElementById('avatarInitials');
    const avatarInitialsLarge = document.getElementById('avatarInitialsLarge');
    
    // State
    let isDropdownOpen = false;
    let touchStartY = 0;
    let isMobile = window.innerWidth <= 768;

    /**
     * Check if user is authenticated and update UI accordingly
     * @returns {boolean} True if user is logged in, false otherwise
     */
    function checkAuth() {
        try {
            // Get user data from localStorage or Firebase auth state
            const userData = localStorage.getItem('user');
            const token = localStorage.getItem('token');
            
            if (userData && token) {
                const user = JSON.parse(userData);
                updateUserInfo(user);
                
                if (userMenu) userMenu.style.display = 'flex';
                document.body.classList.add('user-logged-in');
                
                if (logoutBtn) {
                    logoutBtn.style.display = 'flex';
                    logoutBtn.setAttribute('aria-hidden', 'false');
                }
                
                return true;
            }
        } catch (e) {
            console.error('Error parsing user data:', e);
        }
        
        // If no user data or error, hide user menu
        if (userMenu) userMenu.style.display = 'none';
        document.body.classList.remove('user-logged-in');
        
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
            logoutBtn.setAttribute('aria-hidden', 'true');
        }
        
        return false;
    }
    
    // Listen for auth state changes
    if (window.firebaseAuth) {
        window.firebaseAuth.onAuthStateChanged((user) => {
            if (user) {
                const userData = {
                    name: user.displayName || 'User',
                    email: user.email || '',
                    photoURL: user.photoURL || ''
                };
                updateUserInfo(userData);
                checkAuth();
            } else {
                // Clear any remaining user data
                updateUserInfo({ name: 'Guest', email: '', photoURL: '' });
                checkAuth();
            }
        });
    }

    /**
     * Update user information in the UI
     * @param {Object} user - User object containing name and email
     */
    function updateUserInfo(user) {
        if (!user) return;
        
        const displayName = user.name || 'Guest User';
        const displayEmail = user.email || '';
        
        // Determine what to show as initials
        let initials = 'U'; // Default fallback
        
        if (displayName && displayName !== 'Guest User') {
            // Use first letter of first name if name exists and is not 'Guest User'
            initials = displayName.trim().charAt(0).toUpperCase();
        } else if (displayEmail) {
            // Otherwise use first letter of email
            initials = displayEmail.trim().charAt(0).toUpperCase();
        }
        
        // Update name
        if (userNameEl) {
            userNameEl.textContent = displayName;
            userNameEl.setAttribute('aria-label', `Logged in as ${displayName}`);
        }
        
        // Update email
        if (userEmailEl) {
            const hasEmail = !!displayEmail;
            userEmailEl.textContent = displayEmail || 'No email provided';
            userEmailEl.style.display = hasEmail ? 'block' : 'none';
            userEmailEl.setAttribute('aria-hidden', !hasEmail);
        }
        
        // Update avatar initials
        [avatarInitials, avatarInitialsLarge].forEach(el => {
            if (el) el.textContent = initials;
        });
        
        // Log for debugging
        console.log('Updated user info:', { displayName, displayEmail, initials });
    }

    /**
     * Toggle the dropdown menu
     * @param {Event} e - The event object
     */
    function toggleDropdown(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
            
            // Handle touch events
            if (e.type === 'touchstart') {
                touchStartY = e.touches[0].clientY;
                return;
            }
            
            if (e.type === 'touchend') {
                const touchEndY = e.changedTouches[0].clientY;
                // Only toggle if it's a tap (not a swipe)
                if (Math.abs(touchEndY - touchStartY) < 10) {
                    if (isDropdownOpen) {
                        closeDropdown();
                    } else {
                        openDropdown();
                    }
                }
                return;
            }
        }
        
        // Toggle for click events
        if (isDropdownOpen) {
            closeDropdown();
        } else {
            openDropdown();
        }
    }

    /**
     * Open the dropdown menu
     */
    function openDropdown() {
        if (isDropdownOpen) return;
        
        // Position the dropdown
        if (!isMobile) {
            const rect = userAvatar.getBoundingClientRect();
            dropdownMenu.style.top = `${rect.bottom + window.scrollY + 8}px`;
            dropdownMenu.style.right = `${window.innerWidth - rect.right}px`;
        } else {
            // For mobile, position at bottom of screen
            dropdownMenu.style.top = 'auto';
            dropdownMenu.style.bottom = '0';
            dropdownMenu.style.left = '0';
            dropdownMenu.style.right = '0';
            dropdownMenu.style.width = '100%';
            dropdownMenu.style.maxHeight = '85vh';
            dropdownMenu.style.borderRadius = '16px 16px 0 0';
        }
        
        // Trigger reflow to ensure transition works
        dropdownMenu.offsetHeight;
        
        // Show the dropdown and backdrop
        document.body.style.overflow = 'hidden';
        dropdownMenu.classList.add('show');
        dropdownBackdrop.classList.add('show');
        
        // Update state and ARIA
        isDropdownOpen = true;
        userAvatar.setAttribute('aria-expanded', 'true');
        
        // Focus management
        setTimeout(() => {
            const firstFocusable = dropdownMenu.querySelector('button, a, [tabindex]:not([tabindex="-1"])');
            if (firstFocusable) firstFocusable.focus();
        }, 50);
        
        // Add event listeners
        document.addEventListener('click', handleClickOutside, { passive: true });
        document.addEventListener('keydown', handleKeyDown, { passive: true });
        window.addEventListener('resize', handleResize, { passive: true });
        
        // Close on backdrop click
        dropdownBackdrop.addEventListener('click', closeDropdown, { passive: true });
        
        // Prevent body scroll when dropdown is open on mobile
        if (isMobile) {
            document.body.style.overflow = 'hidden';
        }
    }

    /**
     * Close the dropdown menu
     */
    function closeDropdown() {
        dropdownMenu.classList.remove('show');
        dropdownBackdrop.classList.remove('show');
        userAvatar.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
        isDropdownOpen = false;
    }

    /**
     * Handle window resize events
     */
    function handleResize() {
        isMobile = window.innerWidth <= 768;
        if (isDropdownOpen && !isMobile) {
            const rect = userAvatar.getBoundingClientRect();
            dropdownMenu.style.top = `${rect.bottom + window.scrollY + 8}px`;
            dropdownMenu.style.right = `${window.innerWidth - rect.right}px`;
        }
    }
    
    /**
     * Handle clicks outside the dropdown
     * @param {Event} e - The click event
     */
    function handleClickOutside(e) {
        if (isDropdownOpen && 
            !dropdownMenu.contains(e.target) && 
            !userAvatar.contains(e.target)) {
            closeDropdown();
        }
    }

    /**
     * Handle keyboard navigation
     * @param {KeyboardEvent} e - The keydown event
     */
    function handleKeyDown(e) {
        if (!isDropdownOpen) return;
        
        const focusableElements = Array.from(
            dropdownMenu.querySelectorAll('button, a, [tabindex]:not([tabindex="-1"])')
        ).filter(el => {
            return !el.disabled && el.offsetParent !== null;
        });
        
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                closeDropdown();
                break;
                
            case 'Tab':
                if (focusableElements.length === 0) return;
                
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        e.preventDefault();
                        lastElement.focus();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        e.preventDefault();
                        firstElement.focus();
                    }
                }
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                if (document.activeElement === firstElement) {
                    lastElement.focus();
                } else {
                    const currentIndex = focusableElements.indexOf(document.activeElement);
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : focusableElements.length - 1;
                    focusableElements[prevIndex].focus();
                }
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                if (document.activeElement === lastElement) {
                    firstElement.focus();
                } else {
                    const currentIndex = focusableElements.indexOf(document.activeElement);
                    const nextIndex = currentIndex < focusableElements.length - 1 ? currentIndex + 1 : 0;
                    focusableElements[nextIndex].focus();
                }
                break;
                
            case 'Home':
                e.preventDefault();
                firstElement.focus();
                break;
                
            case 'End':
                e.preventDefault();
                lastElement.focus();
                break;
        }
    }

    /**
     * Handle logout action with custom confirmation dialog
     */
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
                    backdrop-filter: blur(2px);
                }
                .confirmation-content {
                    background: white;
                    padding: 20px;
                    border-radius: 8px;
                    max-width: 90%;
                    width: 400px;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                    text-align: center;
                }
                .confirmation-content p {
                    margin-bottom: 20px;
                    font-size: 16px;
                    color: #333;
                }
                .confirmation-buttons {
                    display: flex;
                    gap: 12px;
                    justify-content: center;
                }
                .confirmation-buttons button {
                    padding: 8px 20px;
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .confirmation-buttons button:hover {
                    opacity: 0.9;
                }
                #confirmLogout {
                    background-color: #dc3545;
                    color: white;
                }
                #cancelLogout {
                    background-color: #6c757d;
                    color: white;
                }
            `;
            document.head.appendChild(style);
        }

        // Show the dialog
        document.body.appendChild(dialog);
        document.body.style.overflow = 'hidden';

        // Handle button clicks
        return new Promise((resolve) => {
            const confirmBtn = document.getElementById('confirmLogout');
            const cancelBtn = document.getElementById('cancelLogout');

            const cleanup = () => {
                document.body.removeChild(dialog);
                document.body.style.overflow = '';
                document.removeEventListener('keydown', handleEscape);
            };

            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    cleanup();
                    resolve(false);
                }
            };

            confirmBtn.onclick = async () => {
                cleanup();
                try {
                    // Sign out from Firebase
                    if (window.firebaseAuth) {
                        await window.firebaseAuth.signOut();
                        
                        // Clear user data from localStorage
                        localStorage.removeItem('user');
                        localStorage.removeItem('token');
                        
                        // Update UI
                        updateUserInfo({ name: 'Guest User', email: '' });
                        document.body.classList.remove('user-logged-in');
                        
                        // Show auth buttons
                        const authButtons = document.querySelector('.auth-buttons');
                        if (authButtons) {
                            authButtons.style.display = 'flex';
                            authButtons.setAttribute('aria-hidden', 'false');
                        }
                        
                        // Show success message
                        showToast('You have been logged out', 'success');
                        
                        // Close dropdown if open
                        if (isDropdownOpen) {
                            closeDropdown();
                        }
                        
                        // Redirect to home page after a short delay
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 1000);
                    }
                } catch (error) {
                    console.error('Logout error:', error);
                    showToast('Error logging out. Please try again.', 'error');
                }
                resolve(true);
            };

            cancelBtn.onclick = () => {
                cleanup();
                resolve(false);
            };

            document.addEventListener('keydown', handleEscape);
        });
    }

    /**
     * Handle My Tasks click
     * @param {Event} e - The click event
     */
    function handleMyTasks(e) {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        
        try {
            // Close dropdown
            closeDropdown();
            
            // Add your My Tasks functionality here
            console.log('My Tasks clicked');
            
            // Example: Scroll to tasks section if it exists
            const tasksSection = document.getElementById('tasks');
            if (tasksSection) {
                tasksSection.scrollIntoView({ behavior: 'smooth' });
            }
            
            // Or dispatch a custom event that other parts of your app can listen for
            document.dispatchEvent(new CustomEvent('myTasksClicked'));
            
        } catch (error) {
            console.error('Error in handleMyTasks:', error);
        }
    }

    /**
     * Initialize event listeners
     */
    function initEventListeners() {
        // Avatar click/touch events
        if (userAvatar) {
            // Mouse/touch events
            userAvatar.addEventListener('click', toggleDropdown);
            userAvatar.addEventListener('touchstart', (e) => {
                touchStartY = e.touches[0].clientY;
                userAvatar.classList.add('active');
            }, { passive: true });
            
            userAvatar.addEventListener('touchend', (e) => {
                const touchEndY = e.changedTouches[0].clientY;
                // Only toggle if it's a tap (not a swipe)
                if (Math.abs(touchEndY - touchStartY) < 10) {
                    toggleDropdown(e);
                }
                userAvatar.classList.remove('active');
            }, { passive: true });
            
            // Keyboard navigation
            userAvatar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
                    e.preventDefault();
                    toggleDropdown(e);
                } else if (e.key === 'ArrowDown' && !isDropdownOpen) {
                    e.preventDefault();
                    openDropdown();
                }
            });
        }
        
        // Logout button
        if (logoutBtn) {
            // Remove any existing event listeners to prevent duplicates
            const newLogoutBtn = logoutBtn.cloneNode(true);
            logoutBtn.parentNode.replaceChild(newLogoutBtn, logoutBtn);
            
            // Store the original href to prevent default navigation
            const originalHref = newLogoutBtn.href || '#';
            newLogoutBtn.href = 'javascript:void(0)';
            
            // Add new event listeners with proper prevention
            const handleLogoutClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                handleLogout(e);
                return false;
            };
            
            // Remove any existing event listeners first
            newLogoutBtn.removeEventListener('click', handleLogoutClick);
            newLogoutBtn.removeEventListener('touchend', handleLogoutClick);
            
            // Add new listeners
            newLogoutBtn.addEventListener('click', handleLogoutClick, true);
            newLogoutBtn.addEventListener('touchend', handleLogoutClick, true);
            
            // Handle keyboard events
            newLogoutBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    handleLogout(e);
                    return false;
                }
            }, true);
            
            // Update the reference
            window.logoutBtn = newLogoutBtn;
        }
        
        // My Tasks button
        if (myTasksBtn) {
            myTasksBtn.addEventListener('click', handleMyTasks);
            myTasksBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleMyTasks(e);
                }
            });
        }
        
        // Handle window resize for responsive behavior
        let resizeTimer;
        const handleResize = () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                isMobile = window.innerWidth <= 768;
                if (isDropdownOpen) {
                    closeDropdown();
                    if (dropdownMenu.classList.contains('show')) {
                        openDropdown(); // Reposition on resize
                    }
                }
            }, 250);
        };
        
        window.addEventListener('resize', handleResize, { passive: true });
        
        // Handle orientation changes
        window.addEventListener('orientationchange', () => {
            if (isDropdownOpen) {
                closeDropdown();
            }
        }, { passive: true });
    }

    /**
     * Initialize the user menu
     */
    function init() {
        console.log('Initializing user menu...');
        
        // Check authentication status
        const isAuthenticated = checkAuth();
        
        // Initialize event listeners
        initEventListeners();
        
        // Log successful initialization
        console.log('User menu initialized');
        
        return isAuthenticated;
    }

    // Start the script
    init();
});
