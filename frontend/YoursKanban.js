// Import API services and modules
import { authAPI, tasksAPI, isLoggedIn } from './js/api.js';
import { updateUserAvatar } from './js/user.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { auth } from './js/firebase.js';

/**
 * Application State Management
 * @namespace state
 * @property {Array} tasks - Array of task objects
 * @property {string} theme - Current theme ('light' or 'dark')
 * @property {string} filterQuery - Current search query
 * @property {string} priorityFilter - Priority filter ('all', 'high', 'medium', 'low')
 * @property {string} sortOrder - Sort order ('none', 'asc', 'desc')
 * @property {Object|null} lastDeletedTask - Last deleted task for undo functionality
 * @property {Object|null} currentUser - Currently logged in user
 */
const state = {
    tasks: [],
    currentUser: null,
    theme: (() => {
        try {
            return localStorage.getItem('kanbanflow_theme') || 'light';
        } catch (error) {
            console.error('Error accessing localStorage:', error);
            return 'light';
        }
    })(),
    filterQuery: '',
    priorityFilter: 'all',
    sortOrder: 'none',
    lastDeletedTask: null,
    isAuthenticated: false
};

// Global variable for delete confirmation
let taskToDelete = null;

// Global flag to prevent re-rendering during drag operations
let isDragging = false;

// Toast Notification System
function showToast(message, type = 'info', duration = 5000, undoAction = null) {
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
        ${undoAction ? `<button class="toast-undo" id="${toastId}-undo">Undo</button>` : ''}
        <button class="toast-close" id="${toastId}-close">&times;</button>
    `;

    container.appendChild(toast);

    // Trigger reflow to enable the show animation
    setTimeout(() => toast.classList.add('show'), 10);

    // Set up close button
    const closeBtn = document.getElementById(`${toastId}-close`);
    if (closeBtn) {
        closeBtn.onclick = () => {
            hideToast(toast);
        };
    }

    // Set up undo button if applicable
    if (undoAction) {
        const undoBtn = document.getElementById(`${toastId}-undo`);
        if (undoBtn) {
            undoBtn.onclick = (e) => {
                e.stopPropagation();
                undoAction();
                hideToast(toast);
            };
        }
    }

    // Auto-hide after duration
    const timeoutId = setTimeout(() => {
        hideToast(toast);
    }, duration);

    // Store timeout ID on the toast element for cleanup
    toast.timeoutId = timeoutId;

    // Pause auto-hide on hover
    toast.addEventListener('mouseenter', () => {
        clearTimeout(timeoutId);
    });

    // Resume auto-hide when mouse leaves
    toast.addEventListener('mouseleave', () => {
        toast.timeoutId = setTimeout(() => {
            hideToast(toast);
        }, 1000);
    });

    return toast;
}

function hideToast(toastElement) {
    if (!toastElement) return;

    // Clear any pending timeout
    if (toastElement.timeoutId) {
        clearTimeout(toastElement.timeoutId);
    }

    // Start hide animation
    toastElement.classList.remove('show');

    // Remove from DOM after animation completes
    setTimeout(() => {
        if (toastElement && toastElement.parentNode) {
            toastElement.parentNode.removeChild(toastElement);
        }
    }, 300);
}

// DOM Elements
const DOM = {
    board: document.getElementById('board'),
    modal: document.getElementById('modalOverlay'),
    form: document.getElementById('taskForm'),
    searchInput: document.getElementById('searchInput'),
    themeToggle: document.getElementById('themeToggle'),
    clearBtn: document.getElementById('clearBoard'),
    closeModal: document.getElementById('closeModal')
};

// Constants
const COLUMNS = [
    { id: 'todo', title: '<i class="fas fa-list-ul"></i> To Do' },
    { id: 'progress', title: '<i class="fas fa-spinner"></i> In Progress' },
    { id: 'done', title: '<i class="fas fa-check-circle"></i> Done' }
];


// Saves the current application state to localStorage
function saveState() {
    try {
        const stateToSave = {
            tasks: state.tasks,
            lastDeletedTask: state.lastDeletedTask
        };
        localStorage.setItem('kanbanflow_state', JSON.stringify(stateToSave));
    } catch (error) {
        console.error('Failed to save state:', error);
        showToast('Failed to save board state', 'error');
    }
}

// Loads the application state from localStorage
function loadState() {
    try {
        const savedState = localStorage.getItem('kanbanflow_state');
        if (savedState) {
            const parsedState = JSON.parse(savedState);

            // Validate and set state with fallbacks
            state.tasks = Array.isArray(parsedState.tasks) ? parsedState.tasks : [];
            state.lastDeletedTask = parsedState.lastDeletedTask || null;

            // Clean up any invalid tasks and ensure they have required fields
            state.tasks = state.tasks.map(task => ({
                ...task,
                files: Array.isArray(task.files) ? task.files : []
            })).filter(task => 
                task &&
                typeof task.id === 'string' &&
                ['todo', 'in-progress', 'done'].includes(task.status)
            );

            // Theme is now handled by ThemeManager
        }
    } catch (error) {
        console.error('Failed to load state:', error);
        // Reset to default state on error
        state.tasks = [];
        state.lastDeletedTask = null;
        // Theme will default to system preference via ThemeManager
    }
}

// --- Theme Management ---
const ThemeManager = (() => {
    const STORAGE_KEY = 'kanbanflow_theme';
    const THEME_ATTR = 'data-theme';
    const THEMES = {
        LIGHT: 'light',
        DARK: 'dark'
    };

    // DOM Elements
    let themeToggle = null;

    /**
     * Initialize theme management
     */
    function init() {
        themeToggle = document.getElementById('themeToggle');
        const exportBtn = document.getElementById('exportBoard');

        // Set initial theme
        const savedTheme = getSavedThemePreference();
        setTheme(savedTheme, false);

        // Add event listeners
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', exportBoard);
        }

        // Listen for system theme changes
        const colorSchemeQuery = window.matchMedia('(prefers-color-scheme: dark)');
        if (colorSchemeQuery.addEventListener) {
            colorSchemeQuery.addEventListener('change', handleSystemThemeChange);
        }
    }

    /**
     * Get the user's saved theme preference
     * @returns {string} The saved theme or system preference
     */
    function getSavedThemePreference() {
        try {
            return localStorage.getItem(STORAGE_KEY) || getSystemPreference();
        } catch (error) {
            console.error('Error accessing localStorage:', error);
            return THEMES.LIGHT;
        }
    }

    /**
     * Get system color scheme preference
     * @returns {string} 'dark' or 'light'
     */
    function getSystemPreference() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
            ? THEMES.DARK
            : THEMES.LIGHT;
    }

    /**
     * Handle system theme changes
     * @param {MediaQueryListEvent} event 
     */
    function handleSystemThemeChange(event) {
        // Only apply system theme if user hasn't explicitly set a preference
        if (!localStorage.getItem(STORAGE_KEY)) {
            setTheme(event.matches ? THEMES.DARK : THEMES.LIGHT, false);
        }
    }

    /**
     * Toggle between light and dark themes
     */
    function toggleTheme() {

        const currentTheme = document.documentElement.getAttribute(THEME_ATTR);

        const newTheme = currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;

        setTheme(newTheme, true);
    }

    /**
     * Set the current theme
     * @param {string} theme - Theme to set ('light' or 'dark')
     * @param {boolean} savePreference - Whether to save the preference
     */
    function setTheme(theme, savePreference = true) {


        if (!Object.values(THEMES).includes(theme)) {
            console.warn(`Invalid theme: ${theme}. Defaulting to light.`);
            theme = THEMES.LIGHT;
        }

        // Update the DOM

        document.documentElement.setAttribute(THEME_ATTR, theme);

        // Save preference if requested
        if (savePreference) {
            try {
                localStorage.setItem(STORAGE_KEY, theme);

            } catch (error) {
                console.error('Failed to save theme preference:', error);
            }
        }

        // Update UI

        updateThemeUI(theme);
    }

    /**
     * Update UI elements to reflect the current theme
     * @param {string} theme - Current theme
     */
    function updateThemeUI(theme) {
        if (!themeToggle) return;

        const oppositeTheme = theme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
        const label = `Switch to ${oppositeTheme} mode`;

        themeToggle.setAttribute('aria-label', label);
        themeToggle.setAttribute('title', label);

        // Dispatch custom event for other components
        document.dispatchEvent(new CustomEvent('themeChange', {
            detail: {
                theme,
                oppositeTheme
            }
        }));
    }

    // Public API
    return {
        init,
        getCurrentTheme: () => document.documentElement.getAttribute(THEME_ATTR) || THEMES.LIGHT,
        setTheme,
        toggleTheme: () => toggleTheme() // Ensure we're calling the inner function
    };
})();

// Initialize theme management when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();

    // Set up keyboard shortcut for theme toggle (Alt+T)
    document.addEventListener('keydown', (e) => {
        if (e.altKey && e.key.toLowerCase() === 't') {
            e.preventDefault();
            ThemeManager.toggleTheme();
        }

    });

    attachDragEvents();
}

function getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const icons = {
        // Images
        'jpg': 'fa-file-image',
        'jpeg': 'fa-file-image',
        'png': 'fa-file-image',
        'gif': 'fa-file-image',
        'webp': 'fa-file-image',
        'svg': 'fa-file-image',
        // Documents
        'pdf': 'fa-file-pdf',
        'doc': 'fa-file-word',
        'docx': 'fa-file-word',
        'txt': 'fa-file-alt',
        'rtf': 'fa-file-alt',
        // Spreadsheets
        'xls': 'fa-file-excel',
        'xlsx': 'fa-file-excel',
        'csv': 'fa-file-csv',
        // Archives
        'zip': 'fa-file-archive',
        'rar': 'fa-file-archive',
        '7z': 'fa-file-archive',
        // Code
        'js': 'fa-file-code',
        'html': 'fa-file-code',
        'css': 'fa-file-code',
        'json': 'fa-file-code',
        // Default
        'default': 'fa-file'
    };
    
    return icons[ext] || icons['default'];
}

function createTaskCard(task) {
    const card = document.createElement('div');
    
    // Base classes
    const classes = ['task-card'];
    if (task.pinned) classes.push('pinned');
    
    // Check if task is overdue (before today, not including today)
    if (task.dueDate && task.status !== 'done') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        
        if (dueDate < today) {
            classes.push('overdue');
        }
    }
    
    card.className = classes.join(' ');
    card.draggable = true;
    card.dataset.id = task.id;
    card.dataset.status = task.status;

    // Format due date for task card
    const taskDueDate = task.dueDate || task.due_date;
    let formattedDueDate = null;
    
    if (taskDueDate) {
        try {
            const date = new Date(taskDueDate);
            // Check if date is valid and not the Unix epoch (1970-01-01)
            if (!isNaN(date.getTime()) && 
                date.getFullYear() !== 1970 && 
                date.getTime() > 0) {
                formattedDueDate = date.toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    year: 'numeric' 
                });
            } else {
                // Clear invalid/epoch dates to avoid repeated detection and hide in UI
                formattedDueDate = '';
                try { delete task.dueDate; } catch(_) {}
                try { delete task.due_date; } catch(_) {}
            }
        } catch (error) {
            // On parse error, clear the date to avoid repeated errors
            formattedDueDate = '';
            try { delete task.dueDate; } catch(_) {}
            try { delete task.due_date; } catch(_) {}
        }
    }

    // Calculate progress for subtasks
    const subtasks = task.subtasks || [];
    let progressHTML = '';
    const hasSubtasks = subtasks && subtasks.length > 0;
    
    if (hasSubtasks) {
        const completedCount = subtasks.filter(st => st.is_done || st.is_completed || st.completed).length;
        const progressPercent = Math.round((completedCount / subtasks.length) * 100);
        
        progressHTML = `
            <div class="subtask-progress">
                <div class="progress-bar">
                    <div class="progress" style="width: ${progressPercent}%"></div>
                </div>
                <div class="progress-text">
                    ${completedCount} of ${subtasks.length} tasks
                </div>
            </div>
            <div class="subtask-list">
                ${subtasks.slice(0, 3).map(subtask => `
                    <div class="subtask-preview">
                        <span class="subtask-checkbox ${(subtask.is_done || subtask.is_completed || subtask.completed) ? 'completed' : ''}">
                            ${(subtask.is_done || subtask.is_completed || subtask.completed) ? '✓' : ''}
                        </span>
                        <span class="subtask-text ${(subtask.is_done || subtask.is_completed || subtask.completed) ? 'completed' : ''}">
                            ${sanitize(subtask.description || subtask.text || '')}
                        </span>
                    </div>
                `).join('')}
                ${subtasks.length > 3 ? `
                    <div class="subtask-more">+${subtasks.length - 3} more</div>
                ` : ''}
            </div>
        `;
    }

    // Build the task card HTML
    const cardHTML = [];
    
    // Card header with title and actions
    cardHTML.push(`
        <div class="card-header">
            <div class="card-title" tabindex="0">
                <span class="card-title-text">${sanitize(task.title) || '/'}</span>
                <input type="text" class="card-title-edit" value="${sanitize(task.title) || ''}" style="display: none;">
            </div>
            <div class="card-actions">
                <button class="icon-btn pin-btn ${task.pinned ? 'pinned' : ''}" data-id="${task.id}" title="${task.pinned ? 'Unpin' : 'Pin'}">
                    <i class="fas fa-thumbtack" style="color: ${task.pinned ? '#f59e0b' : '#94a3b8'}; font-size: 13px;"></i>
                </button>
                <button class="icon-btn duplicate-btn" data-id="${task.id}" title="Duplicate">
                    <i class="fas fa-copy" style="color: #94a3b8; font-size: 13px;"></i>
                </button>
                <button class="icon-btn edit-btn" data-id="${task.id}" title="Edit">
                    <i class="fas fa-pencil-alt" style="color: #94a3b8; font-size: 13px;"></i>
                </button>
                <button class="icon-btn delete-btn" data-id="${task.id}" title="Delete">
                    <i class="fas fa-trash" style="color: #94a3b8; font-size: 13px;"></i>
                </button>
            </div>
        </div>
    `);
    
    // Task description
    if (task.description) {
        cardHTML.push(`<div class="card-desc">${sanitize(task.description)}</div>`);
    }
    
    // Subtask Progress - simplified and cleaner
    if (task.subtasks?.length > 0) {
        const completedCount = task.subtasks.filter(st => st.is_done || st.is_completed || st.completed).length;
        const progressPercent = (completedCount / task.subtasks.length) * 100;
        
        cardHTML.push(`
            <div class="subtask-progress">
                <div class="progress-bar">
                    <div class="progress" style="width: ${progressPercent}%"></div>
                </div>
                <div class="progress-text">
                    ${completedCount} of ${task.subtasks.length} tasks
                </div>
            </div>
        `);
    }
    
    // File attachments
    if (task.files?.length > 0) {
        const filesHTML = task.files.map(file => `
            <div class="file-item">
                <i class="fas ${getFileIcon(file.name)} file-icon"></i>
                <span>${file.name}</span>
                <a href="${file.url || '#'}" target="_blank" class="file-link">
                    <i class="fas fa-external-link-alt file-icon"></i>
                </a>
            </div>
        `).join('');
        
        cardHTML.push(`<div class="file-preview">${filesHTML}</div>`);
    }
    
    // Card footer with priority and due date
    cardHTML.push('<div class="card-footer">');
    
    // Priority badge
    const priority = task.priority || 'medium';
    cardHTML.push(`<span class="priority-badge priority-${priority}">${priority.toUpperCase()}</span>`);
    
    // Due date with simple formatting
    if (task.dueDate) {
        cardHTML.push(`
            <div class="card-date">
                <i class="far fa-calendar-alt"></i>
                ${new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
        `);
    }
    
    // Close footer
    cardHTML.push('</div>');
    
    // Set the card HTML
    card.innerHTML = cardHTML.join('');
    
    // Set up inline editing after HTML is rendered
    setupInlineEditing(card, task);

    return card;
}

// --- Drag and Drop ---
function attachDragEvents() {
    const cards = document.querySelectorAll('.task-card');
    const dropzones = document.querySelectorAll('.task-list');

    // Remove any existing event listeners to prevent duplicates
    cards.forEach(card => {
        const newCard = card.cloneNode(true);
        card.parentNode.replaceChild(newCard, card);
    });

    // Add drag events to cards
    document.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            isDragging = true; // Set dragging flag
            e.dataTransfer.setData('text/plain', card.dataset.id);
            setTimeout(() => {
                card.classList.add('dragging');
            }, 0);
        });

        card.addEventListener('dragend', (e) => {
            e.stopPropagation();
            card.classList.remove('dragging');
            isDragging = false; // Clear dragging flag
        });
    });

    // Add drop events to zones
    dropzones.forEach(zone => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = getDragAfterElement(zone, e.clientY);
            const card = document.querySelector('.dragging');
            
            if (!card) return;
            
            if (afterElement) {
                zone.insertBefore(card, afterElement);
            } else {
                zone.appendChild(card);
            }
        });

        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = zone.dataset.status;
            
            // Find the task in the state (handle both string and number IDs)
            const task = state.tasks.find(t => t.id == taskId || t.id === taskId);
            if (!task) {
                console.error('Task not found in state:', taskId);
                return;
            }
            
            const oldStatus = task.status;
            
            // Only update if status changed
            if (oldStatus !== newStatus) {
                // Update local state immediately for instant feedback
                task.status = newStatus;
                
                // Save to backend
                try {
                    await tasksAPI.updateTask(taskId, { status: newStatus });
                    saveState();
                    renderBoard(); // Re-render to ensure consistency
                } catch (error) {
                    console.error('Error updating task status:', error);
                    // Revert on error
                    task.status = oldStatus;
                    renderBoard();
                    showToast('Failed to move task', 'error');
                }
            } else {
                // Even if status didn't change, re-render to ensure proper placement
                renderBoard();
            }
        });
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}


// File Handling
function handleFileDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    const dropZone = document.getElementById('dropZoneOverlay');
    dropZone.classList.remove('active');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        // Get the current task being edited or create a new one
        const taskId = document.getElementById('taskId')?.value;
        const task = taskId ? state.tasks.find(t => t.id === taskId) : null;

        if (task) {
            // Add files to existing task
            task.files = task.files || [];
            Array.from(files).forEach(file => {
                // In a real app, you would upload the file to a server here
                // For this example, we'll just store the file info
                task.files.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    // In a real app, you would have a URL to the uploaded file
                    // For this example, we'll use a data URL for images
                    url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '#'
                });
            });
            saveState();
            renderBoard();
        } else {
            // If no task is being edited, create a new task with the files
            const newTask = {
                id: Date.now().toString(),
                title: files[0].name.split('.')[0], // Use first filename as title
                description: `Added ${files.length} file(s)`,
                status: 'todo',
                priority: 'medium',
                files: Array.from(files).map(file => ({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified,
                    url: file.type.startsWith('image/') ? URL.createObjectURL(file) : '#'
                })),
                createdAt: Date.now()
            };

            state.tasks.push(newTask);
            saveState();
            renderBoard();
        }
    }
}

// --- Event Handlers ---
function setupEventListeners() {
    // File drag and drop
    const dropZone = document.getElementById('dropZoneOverlay');
    const board = document.getElementById('board');

    // Show drop zone when dragging files over the board
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        board.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when dragging files over it
    ['dragenter', 'dragover'].forEach(eventName => {
        board.addEventListener(eventName, () => {
            dropZone.classList.add('active');
        });
    });

    // Remove highlight when leaving
    ['dragleave', 'drop'].forEach(eventName => {
        board.addEventListener(eventName, () => {
            dropZone.classList.remove('active');
        });
    });

    // Handle file drop
    board.addEventListener('drop', handleFileDrop, false);

    // Prevent default drag behaviors
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Sort button
    document.getElementById('sortByDate')?.addEventListener('click', toggleSortOrder);
    
    // Task form submission
    if (DOM.form) {
        DOM.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(DOM.form);
            const taskData = Object.fromEntries(formData);
            
            // Clean and validate date
            if (taskData.dueDate) {
                // First, check if it's a valid YYYY-MM-DD format from date input
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(taskData.dueDate)) {
                    console.warn('Invalid date format, removing dueDate:', taskData.dueDate);
                    delete taskData.dueDate;
                } else {
                    const dueDate = new Date(taskData.dueDate);
                    // Check if date is valid and not the Unix epoch (1970-01-01)
                    if (isNaN(dueDate.getTime()) || 
                        dueDate.getFullYear() === 1970 || 
                        dueDate.getTime() <= 0) {
                        // Invalid or epoch date, remove it
                        delete taskData.dueDate;
                        console.warn('Invalid or epoch date provided, removing dueDate:', taskData.dueDate);
                    } else {
                        // Valid date, keep it in YYYY-MM-DD format
                    }
                }
            }
            
            // Get subtasks
            taskData.subtasks = getSubtasksFromForm();
            
            try {
                if (taskData.id) {
                    // Update existing task
                    await updateTask(taskData.id, taskData);
                } else {
                    // Create new task
                    await createTask(taskData);
                }
                // Ensure board is re-rendered to update overdue status
                renderBoard();
                closeModal();
            } catch (error) {
                console.error('Error saving task:', error);
                showToast('Error saving task: ' + (error.message || 'Unknown error'), 'error');
            }
        });
    }
    
    // Close modal when clicking outside
    if (DOM.modal) {
        DOM.modal.addEventListener('click', (e) => {
            if (e.target === DOM.modal) {
                closeModal();
            }
        });
    }
}

// --- Task Action Handlers ---

// Handle all task actions with event delegation
document.addEventListener('click', async (e) => {
    // Find the closest action button
    const actionBtn = e.target.closest('.pin-btn, .duplicate-btn, .edit-btn, .delete-btn');
    if (!actionBtn) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const taskId = actionBtn.dataset.id;
    if (!taskId) {
        console.error('No task ID found for action');
        return;
    }
    
    try {
        if (actionBtn.classList.contains('pin-btn')) {
            await togglePin(taskId);
        } else if (actionBtn.classList.contains('duplicate-btn')) {
            await duplicateTask(taskId);
        } else if (actionBtn.classList.contains('edit-btn')) {
            openModal(taskId);
        } else if (actionBtn.classList.contains('delete-btn')) {
            await deleteTask(taskId);
        }
    } catch (error) {
        console.error('Error handling task action:', error);
        showToast('Failed to perform action', 'error');
    }
});

// Add/Edit Task delegators
DOM.board.addEventListener('click', (e) => {
    const addBtn = e.target.closest('.add-task-btn');
    if (addBtn) {
        e.preventDefault();
        e.stopPropagation();
        
        const status = addBtn.dataset.status;
        openModal(); // Open modal for new task
        
        // Set the status based on which column button was clicked
        setTimeout(() => {
            const statusSelect = document.getElementById('taskStatus');
            if (statusSelect && status) {
                statusSelect.value = status;
            }
        }, 10);
    }
});

// Toggle task pinned status
async function togglePin(id) {
    try {
        // Find task by ID (check both string and number types)
        const task = state.tasks.find(t => t.id == id || t.id.toString() === id.toString());
        if (!task) {
            console.error('Task not found for pinning. ID:', id, 'Available IDs:', state.tasks.map(t => t.id));
            return;
        }
        
        const newPinnedState = !task.pinned;

        // Optimistic update (update UI immediately)
        task.pinned = newPinnedState;
        saveState();
        renderBoard();

        // Update backend with a spinner on the pin button
        const updateData = { pinned: newPinnedState };
        const pinBtn = document.querySelector(`.pin-btn[data-id="${task.id}"]`);
        const originalInner = pinBtn ? pinBtn.innerHTML : null;
        if (pinBtn) {
            pinBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            pinBtn.disabled = true;
        }

        try {
            const response = await tasksAPI.updateTask(task.id, updateData);
            if (response && (response.data || response.id || typeof response === 'object')) {
                showToast(newPinnedState ? 'Task pinned' : 'Task unpinned', 'success');
            } else {
                throw new Error('Failed to update task');
            }
        } catch (err) {
            // Revert the optimistic update on error
            console.error('Error updating pinned state:', err);
            task.pinned = !newPinnedState;
            saveState();
            renderBoard();
            showToast('Failed to update pin state', 'error');
        } finally {
            if (pinBtn) {
                pinBtn.disabled = false;
                if (originalInner) pinBtn.innerHTML = originalInner;
            }
        }
    } catch (error) {
        console.error('Error pinning/unpinning task:', error);
    }
 }
async function deleteTask(id) {
    try {
        // Find task by ID (check both string and number types)
        const taskIndex = state.tasks.findIndex(t => t.id == id || t.id.toString() === id.toString());
        if (taskIndex === -1) {
            console.error('Task not found for deletion. ID:', id, 'Available IDs:', state.tasks.map(t => t.id));
            showToast('Task not found', 'error');
            return;
        }

        // Show confirmation dialog instead of deleting directly
        showDeleteConfirmation(id);
        return;
        
        // Store the deleted task for potential undo
        state.lastDeletedTask = { ...taskToDelete, deletedAt: Date.now() };

        // Optimistic UI update
        state.tasks.splice(taskIndex, 1);
        saveState();
        renderBoard(); // Immediate feedback

        // Delete from backend
        const response = await tasksAPI.deleteTask(taskToDelete.id);
        
        if (!response?.success) {
            throw new Error('Failed to delete task from server');
        }

        // Show toast with undo option
        showToast(
            'Task deleted',
            'error',
            10000, // Give more time for undo
            async () => {
                // Undo delete action
                if (state.lastDeletedTask) {
                    const { deletedAt, ...task } = state.lastDeletedTask;
                    
                    try {
                        // Recreate the task in the backend
                        const response = await tasksAPI.createTask({
                            ...task,
                            // Let the server generate a new ID
                            id: undefined,
                            createdAt: task.createdAt || new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        });

                        if (response?.success && response.data) {
                            // Add the recreated task to the local state
                            state.tasks.unshift(response.data);
                            saveState();
                            renderBoard();
                            showToast('Task restored', 'success');
                        } else {
                            throw new Error('Failed to recreate task');
                        }
                    } catch (error) {
                        console.error('Error undoing delete:', error);
                        showToast('Failed to restore task', 'error');
                    } finally {
                        state.lastDeletedTask = null;
                    }
                }
            }
        );
    } catch (error) {
        console.error('Error deleting task:', error);
        
        // Revert optimistic update if needed
        if (state.lastDeletedTask) {
            state.tasks.push(state.lastDeletedTask);
            saveState();
            renderBoard();
        }
        state.lastDeletedTask = null;
        showToast('Failed to delete task', 'error');
    }           
}

// Export Function
function exportBoard() {
    const data = {
        version: '1.0',
        tasks: state.tasks,
        theme: state.theme,
        exportedAt: new Date().toISOString()
    };

    const dataStr = JSON.stringify(data, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    const exportName = `yourskanban-${new Date().toISOString().split('T')[0]}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportName);
    linkElement.click();

    showToast('Board exported successfully!', 'success');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;

    // Add icon based on type
    let icon = 'info-circle';
    if (type === 'success') icon = 'check-circle';
    if (type === 'error') icon = 'exclamation-circle';
    if (type === 'warning') icon = 'exclamation-triangle';

    notification.innerHTML = `
        <i class="fas fa-${icon}"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    // Add show class after a small delay to trigger the animation
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);

    // Remove notification after 3 seconds
    const duration = type === 'error' ? 5000 : 3000; // Show errors longer
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

// --- Utility Functions ---
function sanitize(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
}

// Keyboard Shortcuts
function handleKeyboardShortcuts(e) {
    // Don't trigger if typing in an input or textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
    }

    // Close modal with Escape
    if (e.key === 'Escape') {
        if (document.getElementById('modalOverlay').style.display === 'flex') {
            closeModal();
        } else if (document.getElementById('deleteConfirmModal').style.display === 'flex') {
            hideDeleteConfirmation();
        } else if (document.getElementById('keyboardShortcutsModal').style.display === 'flex') {
            document.getElementById('keyboardShortcutsModal').style.display = 'none';
        }
        return;
    }

    // Only process single key shortcuts when not in an input field
    if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA' || document.activeElement.isContentEditable) {
        return;
    }

    // Show keyboard shortcuts help with ?
    if (e.key === '?') {
        e.preventDefault();
        const modal = document.getElementById('keyboardShortcutsModal');
        if (modal) {
            modal.style.display = modal.style.display === 'flex' ? 'none' : 'flex';
        }
        return;
    }

    // Focus search with /
    if (e.key === '/') {
        e.preventDefault();
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.focus();
        }
        return;
    }

    // New task with N
    if (e.key.toLowerCase() === 'n') {
        e.preventDefault();
        const addButtons = document.querySelectorAll('.add-task-btn');
        if (addButtons.length > 0) {
            addButtons[0].click(); // Click the first "Add Task" button
        }
        return;
    }
    
    // Clean up invalid dates with Ctrl+Shift+
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        cleanupInvalidDates();
        return;
    }

    // Toggle theme with T
    if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        ThemeManager.toggleTheme();
        return;
    }
}

// --- Task Cleanup Functions ---
async function cleanupStaleTasks() {
    try {
        // Get all tasks from backend
        const backendTasks = await tasksAPI.getTasks();
        const backendTaskIds = new Set(backendTasks.map(task => task.id));
        
        // Find tasks that exist locally but not on backend
        const staleTasks = state.tasks.filter(task => !backendTaskIds.has(task.id));
        
        if (staleTasks.length > 0) {
            state.tasks = state.tasks.filter(task => backendTaskIds.has(task.id));
            saveState();
            renderBoard();
        }
    } catch (error) {
        console.warn('Error during stale task cleanup:', error);
    }
}

// --- Task Management ---
async function fetchTasks() {
    try {
        // Get the current user from Firebase Auth
        const user = auth.currentUser;
        
        if (!user) {

            state.tasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
            renderBoard();
            return state.tasks;
        }
        // Render cached tasks immediately for fast first paint
        try {
            const cached = JSON.parse(localStorage.getItem('kanbanflow_state') || 'null');
            if (cached && Array.isArray(cached.tasks) && cached.tasks.length > 0) {
                state.tasks = cached.tasks;
                renderBoard();
            }
        } catch (err) {
            // ignore cache parsing errors
        }

        // Do not force a token refresh here (it can block rendering). tasksAPI.request
        // will refresh tokens when needed. Fetch backend tasks and then update UI.
        const tasks = await tasksAPI.getTasks();

        // Normalize field names from snake_case (API) to camelCase (frontend)
        state.tasks = (tasks || []).map(task => ({
            ...task,
            dueDate: task.due_date || task.dueDate,
            subtasks: Array.isArray(task.subtasks) ? task.subtasks : []
        }));

        renderBoard();
        return state.tasks;
    } catch (error) {
        console.error('Error in fetchTasks:', {
            message: error.message,
            code: error.code,
            stack: error.stack
        });
        
        if (error.message.includes('auth/network-request-failed')) {
            showToast('Network error. Please check your connection.', 'error');
        } else if (error.code === 'unauthenticated' || error.code === 401) {
            // If we get an auth error, sign out and show login
            
            await authAPI.logout();
            showToast('Session expired. Please log in again.', 'error');
            state.tasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
        } else {
            showToast('Failed to load tasks', 'error');
            state.tasks = [];
        }
        
        renderBoard();
        return state.tasks;
    }
}

// Inline Editing Functions
function setupInlineEditing(card, task) {
    // Make title editable on double-click
    const titleElement = card.querySelector('.card-title-text');
    if (titleElement) {
        titleElement.contentEditable = false;
        titleElement.style.cursor = 'text';
        
        // Use dblclick for desktop and touchend for mobile double-tap
        let lastTap = 0;
        const enableEdit = () => {
            titleElement.contentEditable = true;
            titleElement.focus();
            titleElement.style.outline = '2px solid #3b82f6';
            titleElement.style.outlineOffset = '2px';
            
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(titleElement);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        };
        
        titleElement.addEventListener('dblclick', enableEdit);
        
        // Mobile double-tap support
        titleElement.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTap < 300) {
                e.preventDefault();
                enableEdit();
            }
            lastTap = now;
        });
        
        titleElement.addEventListener('blur', async () => {
            titleElement.contentEditable = false;
            titleElement.style.outline = 'none';
            const newTitle = titleElement.textContent.trim();
            
            if (newTitle !== task.title && newTitle.length > 0) {
                try {
                    await updateTask(task.id, { title: newTitle });
                    task.title = newTitle;
                } catch (error) {
                    console.error('Error updating title:', error);
                    titleElement.textContent = task.title; // Revert on error
                }
            } else if (newTitle.length === 0) {
                titleElement.textContent = task.title; // Revert empty titles
            }
        });
        
        titleElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                titleElement.blur();
            } else if (e.key === 'Escape') {
                titleElement.textContent = task.title;
                titleElement.blur();
            }
        });
    }
    
    // Make description editable on double-click
    const descElement = card.querySelector('.card-desc');
    if (descElement) {
        descElement.contentEditable = false;
        descElement.style.cursor = 'text';
        
        // Use dblclick for desktop and touchend for mobile double-tap
        let lastTap = 0;
        const enableEdit = () => {
            descElement.contentEditable = true;
            descElement.focus();
            descElement.style.outline = '2px solid #3b82f6';
            descElement.style.outlineOffset = '2px';
            
            // Select all text
            const range = document.createRange();
            range.selectNodeContents(descElement);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
        };
        
        descElement.addEventListener('dblclick', enableEdit);
        
        // Mobile double-tap support
        descElement.addEventListener('touchend', (e) => {
            const now = Date.now();
            if (now - lastTap < 300) {
                e.preventDefault();
                enableEdit();
            }
            lastTap = now;
        });
        
        descElement.addEventListener('blur', async () => {
            descElement.contentEditable = false;
            descElement.style.outline = 'none';
            const newDesc = descElement.textContent.trim();
            
            if (newDesc !== (task.description || '')) {
                try {
                    await updateTask(task.id, { description: newDesc });
                    task.description = newDesc;
                } catch (error) {
                    console.error('Error updating description:', error);
                    descElement.textContent = task.description || ''; // Revert on error
                }
            }
        });
        
        descElement.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                descElement.blur();
            } else if (e.key === 'Escape') {
                descElement.textContent = task.description || '';
                descElement.blur();
            }
        });
    }
}

// Utility function to clean up invalid dates in existing tasks
function cleanupInvalidDates() {
    let cleanedCount = 0;
    
    state.tasks.forEach(task => {
        let needsUpdate = false;
        
        // Check and clean dueDate
        if (task.dueDate) {
            const date = new Date(task.dueDate);
            if (isNaN(date.getTime()) || date.getFullYear() === 1970 || date.getTime() <= 0) {

                delete task.dueDate;
                needsUpdate = true;
                cleanedCount++;
            }
        }
        
        // Check and clean due_date
        if (task.due_date) {
            const date = new Date(task.due_date);
            if (isNaN(date.getTime()) || date.getFullYear() === 1970 || date.getTime() <= 0) {

                delete task.due_date;
                needsUpdate = true;
                cleanedCount++;
            }
        }
        
        if (needsUpdate) {
            task.updatedAt = new Date().toISOString();
        }
    });
    
        if (cleanedCount > 0) {
        saveState();
        renderBoard();
        showToast(`Cleaned up ${cleanedCount} invalid date(s)`, 'success');
        
    } else {
        showToast('No invalid dates found', 'info');
    }
}

// Validate task data for field lengths (VARCHAR 255 limit)
function validateTaskData(taskToValidate) {
    const MAX_LENGTH = 255;
    const validatedTask = {};
    
    Object.entries(taskToValidate).forEach(([key, value]) => {
        if (value === null || value === undefined) {
            validatedTask[key] = value;
        } else if (key === 'subtasks' && Array.isArray(value)) {
            // Keep subtasks as array, but validate individual items
            validatedTask[key] = value.map(subtask => ({
                ...subtask,
                title: subtask.title || subtask.text || '',
                text: subtask.text ? subtask.text.substring(0, MAX_LENGTH) : ''
            }));
        } else if (typeof value === 'string') {
            if (value.length > MAX_LENGTH) {
                validatedTask[key] = value.substring(0, MAX_LENGTH);
            } else {
                validatedTask[key] = value;
            }
        } else {
            validatedTask[key] = value;
        }
    });
    
    return validatedTask;
}

// Function to fix a specific task by ID
function fixTaskDate(taskId) {
    const task = state.tasks.find(t => t.id == taskId || t.id.toString() === taskId.toString());
    if (!task) {
        console.error('Task not found:', taskId);
        return false;
    }
    
    let fixed = false;
    
    if (task.dueDate) {
        const date = new Date(task.dueDate);
        if (isNaN(date.getTime()) || date.getFullYear() === 1970 || date.getTime() <= 0) {

            delete task.dueDate;
            fixed = true;
        }
    }
    
    if (task.due_date) {
        const date = new Date(task.due_date);
        if (isNaN(date.getTime()) || date.getFullYear() === 1970 || date.getTime() <= 0) {

            delete task.due_date;
            fixed = true;
        }
    }
    
        if (fixed) {
        task.updatedAt = new Date().toISOString();
        saveState();
        renderBoard();
        showToast(`Fixed invalid date for task: ${task.title}`, 'success');
        
        return true;
    } else {

        return false;
    }
}

// Task CRUD Operations
async function createTask(taskData) {
    try {
        // Remove id from taskData if it exists (let server generate it)
        const { id, ...taskToCreate } = taskData;
        
        // Add timestamps
        taskToCreate.createdAt = new Date().toISOString();
        taskToCreate.updatedAt = new Date().toISOString();
        
        // Validate field lengths and format data
        const validatedTask = validateTaskData(taskToCreate);
        
        // Debug: Log the data being sent
        
        // Create task in backend
        const response = await tasksAPI.createTask(validatedTask);
        
        
        
        // Handle different response structures
        let createdTask;
        if (response && response.data) {
            createdTask = response.data;
        } else if (response && response.id) {
            createdTask = response;
        } else if (response && typeof response === 'object') {
            createdTask = response;
        } else {
            console.error('Unexpected API response structure:', response);
            throw new Error('Invalid response from server');
        }
        
        // Preserve the original valid date if API returns invalid date
        const originalDueDate = validatedTask.dueDate;
        
        // Clean up any invalid dates returned by the API (backup check)
        if (createdTask.dueDate) {
            const date = new Date(createdTask.dueDate);
            if (isNaN(date.getTime()) || date.getFullYear() === 1970 || date.getTime() <= 0) {
                createdTask.dueDate = originalDueDate; // Restore the original valid date
            }
        }
        if (createdTask.due_date) {
            const date = new Date(createdTask.due_date);
            if (isNaN(date.getTime()) || date.getFullYear() === 1970 || date.getTime() <= 0) {
                createdTask.due_date = originalDueDate; // Restore the original valid date
            }
        }
        
        // Normalize field names from snake_case (API) to camelCase (frontend)
        const normalizedTask = {
            ...createdTask,
            dueDate: createdTask.due_date || createdTask.dueDate,
            subtasks: createdTask.subtasks || []
        };
        
        // Add the new task to local state
        state.tasks.unshift(normalizedTask);
        saveState();
        renderBoard();
        showToast('Task created successfully', 'success');
    } catch (error) {
        console.error('Error creating task:', error);
        throw error;
    }
}

async function updateTask(taskId, taskData) {
    try {
        // Find existing task
        const taskIndex = state.tasks.findIndex(t => t.id == taskId || t.id.toString() === taskId.toString());
        if (taskIndex === -1) {
            throw new Error('Task not found');
        }
        
        // Update timestamp
        taskData.updatedAt = new Date().toISOString();
        
        // Validate field lengths and format data
        const validatedTask = validateTaskData(taskData);
        
        
        
        // Check if this is a temporary task that doesn't exist on backend
        if (taskId.toString().startsWith('temp-')) {
            
            // Just update locally
            const taskIndex = state.tasks.findIndex(t => t.id == taskId || t.id.toString() === taskId.toString());
            if (taskIndex !== -1) {
                state.tasks[taskIndex] = { ...state.tasks[taskIndex], ...validatedTask };
                saveState();
                renderBoard();
                showToast('Task updated locally', 'success');
            }
            return;
        }
        
        // Update task in backend
        try {
            const response = await tasksAPI.updateTask(taskId, validatedTask);
            
            // Handle different response structures
            let updatedTask;
            if (response && response.data) {
                updatedTask = response.data;
            } else if (response && response.id) {
                updatedTask = response;
            } else if (response && typeof response === 'object') {
                updatedTask = response;
            } else {
                console.error('Unexpected API response structure:', response);
                throw new Error('Invalid response from server');
            }
            
            // Normalize field names from snake_case (API) to camelCase (frontend)
            const normalizedTask = {
                ...updatedTask,
                dueDate: updatedTask.due_date || updatedTask.dueDate,
                subtasks: updatedTask.subtasks || []
            };
            
            // Update task in local state
            state.tasks[taskIndex] = normalizedTask;
            saveState();
            renderBoard();
            showToast('Task updated successfully', 'success');
            
        } catch (error) {
            // If task not found on backend, update locally only
            if (error.message && error.message.includes('Task not found')) {
                console.warn('Task not found on backend, updating locally only:', taskId);
                const taskIndex = state.tasks.findIndex(t => t.id == taskId || t.id.toString() === taskId.toString());
                if (taskIndex !== -1) {

                    
                    // Merge the updates, preserving the correct date
                    const updatedTask = { ...state.tasks[taskIndex], ...validatedTask };
                    
                    // Ensure the dueDate is preserved correctly
                    if (validatedTask.dueDate) {
                        updatedTask.dueDate = validatedTask.dueDate;
                    }
                    
                    
                    state.tasks[taskIndex] = updatedTask;
                    saveState();
                    renderBoard();
                    showToast('Task updated locally (not synced with server)', 'warning');
                }
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Error updating task:', error);
        throw error;
    }
}

// Subtasks Management
function loadSubtasks(subtasks) {
    const container = document.getElementById('subtasksContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    subtasks.forEach((subtask, index) => {
        const subtaskEl = document.createElement('div');
        subtaskEl.className = 'subtask';
        subtaskEl.innerHTML = `
            <input type="checkbox" class="subtask-checkbox" ${subtask.completed ? 'checked' : ''} data-index="${index}">
            <input type="text" class="form-control" value="${subtask.text || ''}" data-index="${index}" placeholder="Add an item...">
            <button type="button" class="btn btn-sm btn-outline delete-subtask">
                <i class="fas fa-times"></i>
            </button>
        `;
        container.appendChild(subtaskEl);
    });
}

function addSubtask(text) {
    const container = document.getElementById('subtasksContainer');
    if (!container) return;
    
    const subtaskEl = document.createElement('div');
    subtaskEl.className = 'subtask';
    const index = container.children.length;
    subtaskEl.innerHTML = `
        <input type="checkbox" class="subtask-checkbox" data-index="${index}">
        <input type="text" class="form-control" value="${text}" data-index="${index}" placeholder="Add an item...">
        <button type="button" class="btn btn-sm btn-outline delete-subtask">
            <i class="fas fa-times"></i>
        </button>
    `;
    container.appendChild(subtaskEl);
}

function getSubtasksFromForm() {
    const container = document.getElementById('subtasksContainer');
    if (!container) return [];
    
    const subtaskElements = container.querySelectorAll('.subtask');
    return Array.from(subtaskElements)
        .map(subtaskEl => {
            const textInput = subtaskEl.querySelector('input[type="text"]');
            const checkbox = subtaskEl.querySelector('input[type="checkbox"]');
            const text = textInput ? textInput.value.trim() : '';
            if (text.length === 0) return null;
            
            return {
                text,
                completed: checkbox ? checkbox.checked : false
            };
        })
        .filter(subtask => subtask !== null);
}

// Task Modal Functions
function openModal(taskId = null) {
    const modal = DOM.modal;
    const form = DOM.form;
    const modalTitle = document.getElementById('modalTitle');
    
    if (!modal || !form) {
        console.error('Modal or form not found');
        return;
    }
    
    // Reset form
    form.reset();
    
    if (taskId) {
        // Edit existing task
        const task = state.tasks.find(t => t.id == taskId || t.id.toString() === taskId.toString());
        if (!task) {
            console.error('Task not found:', taskId);
            return;
        }
        
        modalTitle.textContent = 'Edit Task';
        document.getElementById('taskId').value = task.id;
        document.getElementById('taskTitle').value = task.title || '';
        document.getElementById('taskDesc').value = task.description || '';
        document.getElementById('taskPriority').value = task.priority || 'medium';
        document.getElementById('taskStatus').value = task.status || 'todo';
        
        // Handle date format conversion
        const taskDueDate = task.dueDate || task.due_date;
        if (taskDueDate) {
            try {
                const date = new Date(taskDueDate);
                // Check if date is valid and not the Unix epoch (1970-01-01)
                if (!isNaN(date.getTime()) && 
                    date.getFullYear() !== 1970 && 
                    date.getTime() > 0) {
                    // Convert to YYYY-MM-DD format for the date input
                    document.getElementById('taskDueDate').value = date.toISOString().split('T')[0];
                } else {
                    console.warn('Invalid or epoch date detected, clearing:', taskDueDate);
                    document.getElementById('taskDueDate').value = '';
                }
            } catch (error) {
                console.warn('Invalid date format:', taskDueDate);
                document.getElementById('taskDueDate').value = '';
            }
        } else {
            document.getElementById('taskDueDate').value = '';
        }
        
        // Load subtasks
        loadSubtasks(task.subtasks || []);
    } else {
        // Create new task
        modalTitle.textContent = 'New Task';
        document.getElementById('taskId').value = '';
        document.getElementById('taskStatus').value = 'todo'; // Default to todo for new tasks
        loadSubtasks([]);
    }
    
    // Show modal
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = DOM.modal;
    if (modal) {
        modal.style.display = 'none';
    }
}

// Delete Confirmation Modal
function showDeleteConfirmation(taskId) {
    taskToDelete = taskId;
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.style.display = 'flex';
    }
}

function hideDeleteConfirmation() {
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        modal.style.display = 'none';
    }
    taskToDelete = null;
}

async function performDelete() {
    if (!taskToDelete) return;
    
    try {
        // Find task by ID
        const taskIndex = state.tasks.findIndex(t => t.id == taskToDelete || t.id.toString() === taskToDelete.toString());
        if (taskIndex === -1) {
            console.error('Task not found for deletion. ID:', taskToDelete);
            showToast('Task not found', 'error');
            hideDeleteConfirmation();
            return;
        }

        const taskToDeleteObj = state.tasks[taskIndex];
        
        // Store the deleted task for potential undo
        state.lastDeletedTask = { ...taskToDeleteObj, deletedAt: Date.now() };

        // Optimistic UI update
        state.tasks.splice(taskIndex, 1);
        saveState();
        renderBoard(); // Immediate feedback

        // Delete from backend - only if it's not a temporary task
        if (!taskToDelete.toString().startsWith('temp-')) {
            try {
                const response = await tasksAPI.deleteTask(taskToDelete);
                
                // Handle different response structures - some APIs return success: true, others just return status
                if (response === null || response === undefined || 
                    (response && (response.success !== false && response.code !== 'NOT_FOUND'))) {
                    // Success - task deleted or didn't exist on server
                    // Show toast with undo option
                    showToast(
                        'Task deleted',
                        'error',
                        10000, // Give more time for undo
                        async () => {
                            // Undo delete action
                            if (state.lastDeletedTask) {
                                state.tasks.unshift(state.lastDeletedTask);
                                saveState();
                                renderBoard();
                                state.lastDeletedTask = null;
                                showToast('Task restored', 'success');
                            }
                        }
                    );
                } else {
                    // Failed to delete
                    throw new Error('Failed to delete task from server');
                }
            } catch (error) {
                // If delete fails, revert the optimistic update
                state.tasks.splice(taskIndex, 0, taskToDeleteObj);
                saveState();
                renderBoard();
                throw error;
            }
        } else {
            // Temporary task - just show undo option without backend deletion
            showToast(
                'Task deleted',
                'error',
                10000, // Give more time for undo
                async () => {
                    // Undo delete action
                    if (state.lastDeletedTask) {
                        state.tasks.unshift(state.lastDeletedTask);
                        saveState();
                        renderBoard();
                        state.lastDeletedTask = null;
                        showToast('Task restored', 'success');
                    }
                }
            );
        }
    } catch (error) {
        console.error('Error deleting task:', error);
        
        // If task not found on backend, it's already been deleted or never existed on server
        if (error.message && error.message.includes('Task not found')) {
            console.warn('Task not found on backend, cleaning up local state:', taskToDelete);
            
            // Remove from local state if it still exists (double-check)
            const remainingTaskIndex = state.tasks.findIndex(t => t.id == taskToDelete);
            if (remainingTaskIndex !== -1) {
                state.tasks.splice(remainingTaskIndex, 1);
                saveState();
                renderBoard();
            }
            
            showToast('Task deleted ', 'info');
        } else {
            showToast('Error deleting task: ' + (error.message || 'Unknown error'), 'error');
        }
    }
    
    hideDeleteConfirmation();
}

// --- Authentication Modals ---
function closeAuthModal(modalId = 'authModal') {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

function openAuthModal(type = 'login') {
    // Create modal if it doesn't exist
    let modal = document.getElementById('authModal');
    
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'authModal';
        modal.className = 'modal-overlay';
        modal.style.display = 'none';
        
        // Create modal content with template literal
        const modalContent = document.createElement('div');
        modalContent.className = 'modal';
        modalContent.style.maxWidth = '400px';
        
        modalContent.innerHTML = `
            <div class="modal-header">
                <h3>${type === 'login' ? 'Login' : 'Sign Up'}</h3>
                <button class="icon-btn close-btn" aria-label="Close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="authForm">
                    ${type === 'signup' ? `
                    <div class="form-group">
                        <label for="name">Full Name</label>
                        <input type="text" id="name" name="name" class="form-control" required>
                    </div>
                    ` : ''}
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" class="form-control" required>
                    </div>
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password" class="form-control" required 
                            minlength="6" placeholder="At least 6 characters">
                    </div>
                    <div class="form-actions">
                        <button type="submit" class="btn btn-primary btn-block">
                            ${type === 'login' ? 'Login' : 'Create Account'}
                        </button>
                    </div>
                    <div class="auth-footer"></div>
                </form>
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Add event listeners
        const closeBtn = modal.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => closeAuthModal('authModal'));
        }
        
        // Handle auth toggle clicks
        modal.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('.auth-toggle');
            if (toggleBtn) {
                e.preventDefault();
                const newType = toggleBtn.dataset.type;
                openAuthModal(newType);
            }
        });
        
        // Handle form submission
        const form = modal.querySelector('#authForm');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const data = Object.fromEntries(formData);
                
                try {
                    if (type === 'login') {
                        const response = await authAPI.login(data.email, data.password);
                        if (response.token) {
                            localStorage.setItem('token', response.token);
                            const user = await authAPI.getCurrentUser();
                            updateUserAvatar(user);
                            closeAuthModal();
                            showToast('Login successful!', 'success');
                            // Reload the page to ensure all UI is properly updated
                            window.location.reload();
                        }
                    } else {
                        await authAPI.register(data);
                        showToast('Account created successfully! Please log in.', 'success');
                        // Switch to login form after successful registration
                        closeAuthModal('authModal');
                        setTimeout(() => openAuthModal('login'), 500);
                    }
                } catch (error) {
                    console.error('Auth error:', error);
                    const errorMessage = error.message || 'Authentication failed. Please try again.';
                    showToast(errorMessage, 'error');
                    
                    // Highlight the email field in red if it's an email-related error
                    const emailInput = document.querySelector('#authModal input[type="email"]');
                    if (emailInput && (errorMessage.includes('email') || errorMessage.includes('Email'))) {
                        emailInput.style.borderColor = '#ff4444';
                        emailInput.focus();
                    }
                }
            };
        }
        document.body.appendChild(modal);
    }
    
    // Show the modal
    modal.style.display = 'flex';
    
    // Focus on first input
    const firstInput = modal.querySelector('input');
    if (firstInput) firstInput.focus();
}

// Make functions globally available
window.openAuthModal = openAuthModal;
window.closeModal = closeModal; // For task modal
window.closeAuthModal = closeAuthModal; // For auth modal
window.cleanupInvalidDates = cleanupInvalidDates; // For debugging
window.fixTaskDate = fixTaskDate; // For fixing specific tasks

// --- Initialization ---
async function init() {
    try {
        // Initialize theme and other UI components
        ThemeManager.init();
        setupEventListeners();
        
        // Wait for Firebase auth state to be determined
        await new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, async (user) => {
                if (user) {

                    state.currentUser = user;
                    state.isAuthenticated = true;
                    
                    // Load user data and tasks
                    try {
                        await authAPI.getCurrentUser();
                        await fetchTasks();
                        updateGuestBanner();
                    } catch (error) {
                        console.error('Error loading user data:', error);
                        showToast('Error loading your data', 'error');
                    }
                } else {

                    state.currentUser = null;
                    state.isAuthenticated = false;
                    updateGuestBanner();
                }
                resolve();
                unsubscribe(); // Clean up the listener
            });
        });
        
        // Render the board after auth state is determined
        renderBoard();
        
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Error initializing application', 'error');
    }
}

// Show guest mode banner if not logged in
function updateGuestBanner() {
    const guestBanner = document.getElementById('guest-banner');
    if (!guestBanner) return;
    
    if (!isLoggedIn()) {
        guestBanner.style.display = 'block';
    } else {
        guestBanner.style.display = 'none';
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await init();
        
        // Check if user is logged in - getCurrentUser is synchronous
        const user = authAPI.getCurrentUser();
        
        // Show user menu if the element exists and user is logged in
        const userMenu = document.getElementById('userMenu');
        if (userMenu && user) {
            userMenu.style.display = 'flex';
            updateUserAvatar(user);
        }
        
        updateGuestBanner();
        
        // Clean up any stale tasks that might exist locally but not on backend
        if (user) {
            setTimeout(() => {
                cleanupStaleTasks();
            }, 2000); // Run after 2 seconds to allow initial sync
        }
    } catch (error) {
        console.error('Error initializing app:', error);
        showToast('Error initializing app: ' + (error.message || 'Unknown error'), 'error');
    }
    // Set up delete confirmation
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (taskToDelete) {
                performDelete();
            }
        });
    }

    // Set up cancel delete button
    const cancelDeleteBtn = document.getElementById('cancelDelete');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', hideDeleteConfirmation);
    }
    
    // Set up subtask addition
    document.getElementById('addSubtaskBtn')?.addEventListener('click', () => {
        const input = document.getElementById('newSubtaskInput');
        if (input.value.trim()) {
            addSubtask(input.value.trim());
        }
    });

    document.getElementById('newSubtaskInput')?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const input = document.getElementById('newSubtaskInput');
            if (input.value.trim()) {
                addSubtask(input.value.trim());
            }
        }
    });

    document.getElementById('subtasksContainer')?.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.delete-subtask');
        if (deleteBtn) {
            const subtaskEl = deleteBtn.closest('.subtask');
            if (subtaskEl) {
                subtaskEl.remove();
            }
        }
    });
});
