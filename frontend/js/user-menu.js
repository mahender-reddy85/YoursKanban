/**
 * User Menu Dropdown Functionality
 * Handles the user avatar dropdown menu with user info and actions
 */

console.log('User menu script loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM fully loaded');
    
    const userMenu = document.getElementById('userMenu');
    const userAvatar = document.getElementById('userAvatar');
    const dropdownMenu = document.getElementById('userDropdown');
    const dropdownBackdrop = document.getElementById('dropdownBackdrop');
    const myTasksBtn = document.getElementById('myTasksBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameEl = document.getElementById('userName');
    const userEmailEl = document.getElementById('userEmail');
    const avatarInitials = document.getElementById('avatarInitials');
    
    // Debug log to check if elements are found
    console.log('Elements:', {
        userMenu,
        userAvatar,
        dropdownMenu,
        dropdownBackdrop,
        myTasksBtn,
        logoutBtn,
        userNameEl,
        userEmailEl,
        avatarInitials
    });
    
    // Initialize dropdown state
    let isDropdownOpen = false;

    // Check if user is logged in
    function checkAuth() {
        const userData = localStorage.getItem('user') || localStorage.getItem('username');
        
        if (userData) {
            try {
                const user = typeof userData === 'string' && userData.startsWith('{') 
                    ? JSON.parse(userData) 
                    : { name: userData, email: '' };
                
                // Update UI with user data
                updateUserInfo(user);
                
                // Show user menu and hide auth buttons
                userMenu.style.display = 'flex';
                document.body.classList.add('user-logged-in');
                
                // Show logout button if user is logged in
                if (logoutBtn) {
                    logoutBtn.style.display = 'flex';
                }
                
                return true;
            } catch (e) {
                console.error('Error parsing user data:', e);
            }
        }
        
        // Default guest state
        userMenu.style.display = 'flex';
        updateUserInfo({ name: 'Guest User', email: 'guest@example.com' });
        if (logoutBtn) logoutBtn.style.display = 'none';
        return false;
    }

    // Update user info in the UI
    function updateUserInfo(user) {
        if (!user) return;
        
        // Set user name
        if (userNameEl) {
            userNameEl.textContent = user.name || 'Guest User';
        }
        
        // Set user email if available
        if (userEmailEl) {
            userEmailEl.textContent = user.email || 'guest@example.com';
            userEmailEl.style.display = user.email ? 'block' : 'none';
        }
        
        // Set avatar initials
        if (avatarInitials) {
            const initials = user.name 
                ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2)
                : 'GU';
            avatarInitials.textContent = initials;
        }
    }

    // Toggle dropdown menu
    function toggleDropdown(e) {
        e.preventDefault();
        e.stopPropagation();
        
        console.log('Toggle dropdown called');
        
        // Toggle the dropdown state
        isDropdownOpen = !isDropdownOpen;
        
        if (isDropdownOpen) {
            openDropdown();
        } else {
            closeDropdown();
        }
    }
    
    // Open dropdown
    function openDropdown() {
        // Position the dropdown
        const rect = userAvatar.getBoundingClientRect();
        const isMobile = window.innerWidth <= 768;
        
        if (isMobile) {
            // Mobile: Show as bottom sheet
            dropdownMenu.style.top = 'auto';
            dropdownMenu.style.bottom = '0';
            dropdownMenu.style.left = '0';
            dropdownMenu.style.right = '0';
            dropdownMenu.style.width = '100%';
            dropdownMenu.style.borderRadius = '12px 12px 0 0';
        } else {
            // Desktop: Show below avatar
            dropdownMenu.style.position = 'absolute';
            dropdownMenu.style.top = `${rect.bottom + window.scrollY + 8}px`;
            dropdownMenu.style.right = `${window.innerWidth - rect.right}px`;
            dropdownMenu.style.bottom = 'auto';
            dropdownMenu.style.left = 'auto';
            dropdownMenu.style.width = '260px';
            dropdownMenu.style.borderRadius = '8px';
        }
        
        // Show dropdown and backdrop
        dropdownMenu.classList.add('show');
        dropdownBackdrop.classList.add('show');
        userAvatar.setAttribute('aria-expanded', 'true');
        document.body.classList.add('dropdown-open');
        
        // Focus first interactive element for keyboard navigation
        setTimeout(() => {
            const firstFocusable = dropdownMenu.querySelector('a[href], button, [tabindex]');
            if (firstFocusable) firstFocusable.focus();
        }, 10);
    }
    
    // Close dropdown
    function closeDropdown() {
        dropdownMenu.classList.remove('show');
        dropdownBackdrop.classList.remove('show');
        userAvatar.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('dropdown-open');
        
        // Return focus to the avatar button
        setTimeout(() => userAvatar.focus(), 10);
    }

    // Handle click outside
    function handleClickOutside(e) {
        if (dropdownMenu.classList.contains('show') && 
            !dropdownMenu.contains(e.target) && 
            !userAvatar.contains(e.target)) {
            closeDropdown();
        }
    }

    // Handle keyboard navigation
    function handleKeyDown(e) {
        // Close on Escape key
        if (e.key === 'Escape' && dropdownMenu.classList.contains('show')) {
            e.preventDefault();
            closeDropdown();
        }
        
        // Trap focus within dropdown when open
        if (e.key === 'Tab' && dropdownMenu.classList.contains('show')) {
            const focusableElements = Array.from(dropdownMenu.querySelectorAll(
                'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            ));
            
            if (focusableElements.length === 0) return;
            
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            
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
        }
    }

    // Handle logout
    function handleLogout() {
        // Clear auth data
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('username');
        
        // Reset UI to guest state
        updateUserInfo({ name: 'Guest User', email: 'guest@example.com' });
        document.body.classList.remove('user-logged-in');
        
        // Hide logout button
        if (logoutBtn) logoutBtn.style.display = 'none';
        
        // Close dropdown
        closeDropdown();
        
        // Show auth buttons
        const authButtons = document.querySelector('.auth-buttons');
        if (authButtons) authButtons.style.display = 'flex';
        
        // Notify other parts of the app
        document.dispatchEvent(new Event('userLoggedOut'));
    }

    // Handle My Tasks click
    function handleMyTasks(e) {
        e.preventDefault();
        closeDropdown();
        // Here you can implement the My Tasks functionality
        console.log('My Tasks clicked');
        // For example, filter tasks or navigate to a tasks page
    }

    // Initialize event listeners
    function initEventListeners() {
        if (userAvatar) {
            userAvatar.addEventListener('click', toggleDropdown);
            userAvatar.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleDropdown(e);
                }
            });
        }
        
        if (dropdownBackdrop) {
            dropdownBackdrop.addEventListener('click', closeDropdown);
        }
        
        if (myTasksBtn) {
            myTasksBtn.addEventListener('click', handleMyTasks);
        }
        
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                handleLogout();
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', handleClickOutside);
        
        // Handle keyboard navigation
        document.addEventListener('keydown', handleKeyDown);
        
        // Handle window resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                if (dropdownMenu.classList.contains('show')) {
                    openDropdown(); // Reposition on resize
                }
            }, 250);
        });
    }

    // Initialize
    function init() {
        checkAuth();
        initEventListeners();
    }

    // Start the script
    init();
});
