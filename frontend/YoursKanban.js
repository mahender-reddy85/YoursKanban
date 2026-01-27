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

        // Set initial theme
        const savedTheme = getSavedThemePreference();
        setTheme(savedTheme, false);

        // Add event listeners
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
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
        console.log('toggleTheme called');
        const currentTheme = document.documentElement.getAttribute(THEME_ATTR);
        console.log('Current theme:', currentTheme);
        const newTheme = currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
        console.log('New theme:', newTheme);
        setTheme(newTheme, true);
    }

    /**
     * Set the current theme
     * @param {string} theme - Theme to set ('light' or 'dark')
     * @param {boolean} savePreference - Whether to save the preference
     */
    function setTheme(theme, savePreference = true) {
        console.log('setTheme called with:', { theme, savePreference });

        if (!Object.values(THEMES).includes(theme)) {
            console.warn(`Invalid theme: ${theme}. Defaulting to light.`);
            theme = THEMES.LIGHT;
        }

        // Update the DOM
        console.log('Setting theme attribute to:', theme);
        document.documentElement.setAttribute(THEME_ATTR, theme);

        // Save preference if requested
        if (savePreference) {
            try {
                localStorage.setItem(STORAGE_KEY, theme);
                console.log('Theme preference saved to localStorage:', theme);
            } catch (error) {
                console.error('Failed to save theme preference:', error);
            }
        }

        // Update UI
        console.log('Updating UI for theme:', theme);
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
});

// Theme management is now handled by the ThemeManager module
function applyTheme() {
    // This is a compatibility function for existing code
    ThemeManager.setTheme(ThemeManager.getCurrentTheme(), false);
}

// --- UI Rendering ---
function sortTasksByDueDate(tasks, order) {
    if (order === 'none') return [...tasks];

    return [...tasks].sort((a, b) => {
        const dateA = a.dueDate ? new Date(a.dueDate) : new Date(0);
        const dateB = b.dueDate ? new Date(b.dueDate) : new Date(0);

        // If both tasks don't have due dates, maintain their order
        if (!a.dueDate && !b.dueDate) return 0;
        // Tasks without due dates go to the end when sorting in ascending order, or to the start when descending
        if (!a.dueDate) return order === 'asc' ? 1 : -1;
        if (!b.dueDate) return order === 'asc' ? -1 : 1;

        // Sort by date
        return order === 'asc' ? dateA - dateB : dateB - dateA;
    });
}

function toggleSortOrder() {
    // Cycle through sort orders: none -> asc -> desc -> none
    state.sortOrder = state.sortOrder === 'none' ? 'asc' :
        state.sortOrder === 'asc' ? 'desc' : 'none';

    // Update button appearance
    const sortButton = document.getElementById('sortByDate');
    if (sortButton) {
        sortButton.style.opacity = state.sortOrder === 'none' ? '0.6' : '1';
        sortButton.title = state.sortOrder === 'none' ? 'Sort by due date' :
            state.sortOrder === 'asc' ? 'Sort: Oldest first' : 'Sort: Newest first';
    }

    renderBoard();
}

function renderBoard() {
    DOM.board.innerHTML = '';

    COLUMNS.forEach(col => {
        let columnTasks = state.tasks.filter(task => {
            // Filter by status
            if (task.status !== col.id) return false;

            // Filter by search query
            const matchesSearch = state.filterQuery === '' ||
                task.title.toLowerCase().includes(state.filterQuery.toLowerCase()) ||
                (task.description && task.description.toLowerCase().includes(state.filterQuery.toLowerCase()));

            // Filter by priority
            const matchesPriority = state.priorityFilter === 'all' ||
                (task.priority && task.priority.toLowerCase() === state.priorityFilter);

            return matchesSearch && matchesPriority;
        });

        // Apply sorting - pinned tasks first, then by due date if enabled
        columnTasks.sort((a, b) => {
            // Pinned tasks first
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;

            // If sort order is enabled, sort by due date
            if (state.sortOrder !== 'none') {
                return sortTasksByDueDate([a, b], state.sortOrder);
            }

            return 0;
        });

        const colEl = document.createElement('div');
        colEl.className = 'column';
        colEl.dataset.status = col.id;

        colEl.innerHTML = `
            <div class="column-header">
                <h3 class="column-title">
                    ${col.title} <span class="task-count">${columnTasks.length}</span>
                </h3>
                <button class="add-task-btn" data-status="${col.id}">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="task-list" data-status="${col.id}">
                ${columnTasks.length === 0 ? '<div class="empty-state">No tasks here</div>' : ''}
            </div>
        `;

        if (columnTasks.length > 0) {
            const listEl = colEl.querySelector('.task-list');
            columnTasks.forEach(task => {
                listEl.appendChild(createTaskCard(task));
            });
        }

        DOM.board.appendChild(colEl);
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
    
    // Check if task is overdue
    const dueDate = task.due_date || task.dueDate;
    const isOverdue = dueDate && task.status !== 'done' && new Date(dueDate) < new Date();
    if (isOverdue) {
        classes.push('overdue');
    }
    
    card.className = classes.join(' ');
    card.draggable = true;
    card.dataset.id = task.id;
    card.dataset.status = task.status;

    // Set up inline editing after card is created
    setTimeout(() => {
        setupInlineEditing(card, task);
    }, 0);

    // Format due date for task card
    const taskDueDate = task.due_date || task.dueDate;
    const formattedDueDate = taskDueDate 
        ? new Date(taskDueDate).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
          })
        : null;

    // Calculate progress for subtasks
    let progressHTML = '';
    const subtasks = task.subtasks || [];
    if (subtasks.length > 0) {
        const completedCount = subtasks.filter(st => st.is_completed || st.completed).length;
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
                        <span class="subtask-checkbox ${(subtask.is_completed || subtask.completed) ? 'completed' : ''}">
                            ${(subtask.is_completed || subtask.completed) ? '✓' : ''}
                        </span>
                        <span class="subtask-text ${(subtask.is_completed || subtask.completed) ? 'completed' : ''}">
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

    // Calculate progress for the progress bar
    const hasSubtasks = subtasks && subtasks.length > 0;
    const completedSubtasks = hasSubtasks ? subtasks.filter(st => st.is_completed || st.completed).length : 0;
    const totalSubtasks = hasSubtasks ? subtasks.length : 0;
    const progressPercent = hasSubtasks ? (completedSubtasks / totalSubtasks) * 100 : 0;

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
    
    // Subtask progress
    if (hasSubtasks) {
        cardHTML.push(`
            <div class="subtask-progress">
                <div class="progress-bar">
                    <div class="progress" style="width: ${progressPercent}%"></div>
                </div>
                <div class="progress-text">
                    ${completedSubtasks} of ${totalSubtasks} tasks
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
    
    // Due date
    if (formattedDueDate) {
        cardHTML.push(`
            <div class="card-date">
                <i class="far fa-calendar-alt"></i>
                ${formattedDueDate}
            </div>
        `);
    }
    
    // Close footer
    cardHTML.push('</div>');
    
    // Set the card HTML
    card.innerHTML = cardHTML.join('');

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
            e.dataTransfer.setData('text/plain', card.dataset.id);
            setTimeout(() => {
                card.classList.add('dragging');
            }, 0);
        });

        card.addEventListener('dragend', (e) => {
            e.stopPropagation();
            card.classList.remove('dragging');
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
            
            // Update visual feedback
            zone.querySelectorAll('.task-card').forEach((c, index) => {
                c.style.order = index;
            });
        });

        zone.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const taskId = e.dataTransfer.getData('text/plain');
            const newStatus = zone.dataset.status;
            
            // Find the task in the state
            const taskIndex = state.tasks.findIndex(t => t.id === taskId);
            if (taskIndex === -1) return;
            
            // Update the task status
            const task = state.tasks[taskIndex];
            const oldStatus = task.status;
            
            // Only update if status changed
            if (oldStatus !== newStatus) {
                task.status = newStatus;
                
                // Save to backend
                try {
                    await tasksAPI.updateTask(taskId, { status: newStatus });
                    saveState();
                    renderBoard();
                } catch (error) {
                    console.error('Error updating task status:', error);
                    // Revert on error
                    task.status = oldStatus;
                    renderBoard();
                    showToast('Failed to move task', 'error');
                }
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

async function updateTaskStatus(id, status) {
    try {
        const task = state.tasks.find(t => t.id === id);
        if (!task) return;
        
        // Update local state immediately for instant feedback
        const oldStatus = task.status;
        task.status = status;
        
        // Update the task in the backend
        const response = await tasksAPI.updateTask(id, { status });
        
        if (!response || !response.success) {
            // Revert if update fails
            task.status = oldStatus;
            throw new Error('Failed to update task status');
        }
        
        // Update local state with server response
        if (response.data) {
            Object.assign(task, response.data);
        }
        
        saveState();
        return task;
    } catch (error) {
        console.error('Error updating task status:', error);
        showToast('Failed to update task status', 'error');
        renderBoard(); // Re-render to ensure UI consistency
        throw error;
    }
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
    // ... (rest of the code remains the same)
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
        
        // Optimistic update
        task.pinned = newPinnedState;
        saveState();
        
        // Update backend
        const response = await tasksAPI.updateTask(task.id, { 
            pinned: newPinnedState 
        });
        
        if (response?.success) {
            showToast(newPinnedState ? 'Task pinned' : 'Task unpinned', 'success');
        } else {
            throw new Error('Failed to update task');
        }
    } catch (error) {
        console.error('Error toggling pin:', error);
        showToast('Failed to update task', 'error');
        renderBoard();
    }
}

// Duplicate task
async function duplicateTask(id) {
    // Find task by ID (check both string and number types)
    const taskToDuplicate = state.tasks.find(t => t.id == id || t.id.toString() === id.toString());
    if (!taskToDuplicate) {
        console.error('Task not found for duplication. ID:', id, 'Available IDs:', state.tasks.map(t => t.id));
        showToast('Task not found', 'error');
        return;
    }
    
    // Show loading state
    const button = document.querySelector(`.duplicate-btn[data-id="${id}"]`);
    const originalHTML = button?.innerHTML;
    if (button) {
        button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        button.disabled = true;
    }

    try {
        // Create a deep copy of the task with a new ID and updated title
        const newTask = JSON.parse(JSON.stringify(taskToDuplicate));
        newTask.id = `temp-${Date.now()}`;
        newTask.title = taskToDuplicate.title.includes(' (Copy)') 
            ? taskToDuplicate.title 
            : `${taskToDuplicate.title} (Copy)`;
        newTask.pinned = false;
        newTask.createdAt = new Date().toISOString();
        newTask.updatedAt = new Date().toISOString();
        
        // Create task data for the server (without the temporary ID)
        const taskToCreate = { ...newTask };
        delete taskToCreate.id;

        // Optimistic UI update
        state.tasks.unshift(newTask);
        saveState();
        renderBoard();
        
        // Create task in the backend
        const response = await tasksAPI.createTask(taskToCreate);
        
        if (response?.success && response.data) {
            // Replace the temporary task with the one from the server
            const taskIndex = state.tasks.findIndex(t => t.id === newTask.id);
            if (taskIndex !== -1) {
                state.tasks[taskIndex] = response.data;
                saveState();
                showToast('Task duplicated', 'success');
            }
        } else {
            throw new Error('Failed to create duplicate task');
        }
    } catch (error) {
        console.error('Error duplicating task:', error);
        showToast('Failed to duplicate task', 'error');
    } finally {
        // Restore button state
        if (button) {
            button.innerHTML = originalHTML || '<i class="fas fa-copy"></i>';
            button.disabled = false;
        }
        renderBoard();
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

        const taskToDelete = state.tasks[taskIndex];
        
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

    showNotification('Board exported successfully!', 'success');
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

    // Toggle theme with T
    if (e.key.toLowerCase() === 't') {
        e.preventDefault();
        ThemeManager.toggleTheme();
        return;
    }
}

// --- Task Management ---
async function fetchTasks() {
    try {
        // Get the current user from Firebase Auth
        const user = auth.currentUser;
        
        if (!user) {
            console.log('No authenticated user, using guest tasks');
            state.tasks = JSON.parse(localStorage.getItem('guest_tasks') || '[]');
            renderBoard();
            return state.tasks;
        }

        // Force token refresh before making the request
        console.log('Getting fresh token for task fetch...');
        const token = await user.getIdToken(true);
        console.log('Token refresh successful, fetching tasks...');
        
        const tasks = await tasksAPI.getTasks();
        state.tasks = tasks || [];
        renderBoard();
        return tasks;
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
            console.log('Authentication error, signing out...');
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

// --- Authentication Modals ---
function closeModal(modalId = 'authModal') {
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
            closeBtn.addEventListener('click', () => closeModal('authModal'));
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
                            closeModal();
                            showToast('Login successful!', 'success');
                            // Reload the page to ensure all UI is properly updated
                            window.location.reload();
                        }
                    } else {
                        await authAPI.register(data);
                        showToast('Account created successfully! Please log in.', 'success');
                        // Switch to login form after successful registration
                        closeModal('authModal');
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
    
    // Handle form submission
    const form = modal.querySelector('form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            
            try {
                if (type === 'login') {
                    await authAPI.login(data.email, data.password);
                    showToast('Logged in successfully', 'success');
                    closeModal('authModal');
                    location.reload(); // Refresh to update UI
                } else {
                    // Registration flow
                    try {
                        await authAPI.register(data);
                        showToast('Account created successfully! Please log in.', 'success');
                        // Switch to login form after successful registration
                        closeModal('authModal');
                        setTimeout(() => openAuthModal('login'), 500);
                    } catch (regError) {
                        // Check if this is an email already in use error
                        if (regError.message.includes('Email already in use') || 
                            (regError.response && regError.response.status === 400)) {
                            showToast('This email is already registered. Please use a different email or log in.', 'error');
                        } else {
                            throw regError; // Re-throw other errors
                        }
                    }
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
}

// Make functions globally available
window.openAuthModal = openAuthModal;
window.closeModal = closeModal;

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
                    console.log("User is signed in:", user.uid);
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
                    console.log("No user is signed in");
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
    } catch (error) {
        console.error('Error initializing app:', error);
        showToast('Error initializing app: ' + (error.message || 'Unknown error'), 'error');
    }
    // Set up delete confirmation
    const confirmDeleteBtn = document.getElementById('confirmDelete');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (taskToDelete) {
                deleteTask(taskToDelete);
                hideDeleteConfirmation();
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
