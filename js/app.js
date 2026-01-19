// Import modules
import { Auth } from './auth.js';
import { ThemeManager } from './theme.js';
import { setupEventListeners, renderBoard } from './ui.js';

// Application state
const state = {
    tasks: [],
    currentUser: null,
    isAuthenticated: false,
    theme: localStorage.getItem('kanbanflow_theme') || 'light',
    filterQuery: '',
    priorityFilter: 'all',
    sortOrder: 'none',
    lastDeletedTask: null
};

// Initialize the application
async function init() {
    try {
        // Initialize theme
        ThemeManager.init();
        
        // Check authentication status
        const isAuthenticated = await Auth.checkAuth();
        
        if (isAuthenticated) {
            // Load tasks if authenticated
            await fetchTasks();
        } else {
            // Show login modal if not authenticated
            showModal('loginModal');
        }
        
        // Set up event listeners
        setupEventListeners();
        
        // Initial render
        renderBoard();
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Failed to initialize application', 'error');
    }
}

// Fetch tasks from the server
async function fetchTasks() {
    try {
        const response = await fetch('/api/tasks', {
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch tasks');
        }
        
        const tasks = await response.json();
        state.tasks = tasks;
        renderBoard();
    } catch (error) {
        console.error('Error fetching tasks:', error);
        showToast('Failed to load tasks', 'error');
    }
}

// Show a toast notification
function showToast(message, type = 'info', duration = 5000) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const toastId = 'toast-' + Date.now();
    toast.id = toastId;
    
    let icon = 'ℹ️';
    switch (type) {
        case 'success':
            icon = '✅';
            break;
        case 'error':
            icon = '❌';
            break;
        case 'warning':
            icon = '⚠️';
            break;
    }
    
    toast.innerHTML = `
        <span class="toast-message">${icon} ${message}</span>
        <button class="toast-close" aria-label="Close">&times;</button>
    `;
    
    container.appendChild(toast);
    
    // Show the toast
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    
    // Auto-hide after duration
    const timeout = setTimeout(() => {
        hideToast(toastId);
    }, duration);
    
    // Close button
    const closeButton = toast.querySelector('.toast-close');
    closeButton.addEventListener('click', () => {
        clearTimeout(timeout);
        hideToast(toastId);
    });
}

// Hide a toast notification
function hideToast(id) {
    const toast = document.getElementById(id);
    if (toast) {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }
}

// Show a modal by ID
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Focus the first input in the modal
        const firstInput = modal.querySelector('input, button, [tabindex]');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

// Hide a modal by ID
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Close modal when clicking outside
function setupModalCloseOnOutsideClick() {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-overlay')) {
            hideModal(e.target.id);
        }
    });
}

// Close modal with Escape key
function setupModalCloseOnEscape() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay[style*="display: flex"]');
            if (activeModal) {
                hideModal(activeModal.id);
            }
        }
    });
}

// Initialize the application when the DOM is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Export for debugging
window.app = {
    state,
    showToast,
    showModal,
    hideModal
};

// Export for other modules
export { state, showToast, showModal, hideModal };
