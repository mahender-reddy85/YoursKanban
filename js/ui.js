import { state } from './state.js';
import { showToast, showModal, hideModal } from './app.js';
import { tasksAPI } from './api.js';

// DOM Elements
const DOM = {
    // Board elements
    board: document.getElementById('board'),
    searchInput: document.getElementById('searchInput'),
    priorityFilter: document.getElementById('priorityFilter'),
    clearBoardBtn: document.getElementById('clearBoard'),
    themeToggle: document.getElementById('themeToggle'),
    
    // Task modal elements
    taskModal: document.getElementById('modalOverlay'),
    taskForm: document.getElementById('taskForm'),
    taskId: document.getElementById('taskId'),
    taskTitle: document.getElementById('taskTitle'),
    taskDesc: document.getElementById('taskDesc'),
    taskPriority: document.getElementById('taskPriority'),
    taskStatus: document.getElementById('taskStatus'),
    taskDueDate: document.getElementById('taskDueDate'),
    subtasksContainer: document.getElementById('subtasksContainer'),
    newSubtaskInput: document.getElementById('newSubtaskInput'),
    addSubtaskBtn: document.getElementById('addSubtaskBtn'),
    
    // Confirmation modals
    deleteConfirmModal: document.getElementById('deleteConfirmModal'),
    clearBoardModal: document.getElementById('clearBoardModal'),
    confirmDeleteBtn: document.getElementById('confirmDelete'),
    cancelDeleteBtn: document.getElementById('cancelDelete'),
    confirmClearBoardBtn: document.getElementById('confirmClearBoard'),
    cancelClearBoardBtn: document.getElementById('cancelClearBoard'),
    
    // Auth elements
    authButton: document.getElementById('authButton'),
    userMenu: document.getElementById('userMenu'),
    userName: document.getElementById('userName'),
    logoutButton: document.getElementById('logoutButton'),
    loginForm: document.getElementById('loginForm'),
    registerForm: document.getElementById('registerForm'),
    loginEmail: document.getElementById('loginEmail'),
    loginPassword: document.getElementById('loginPassword'),
    loginErrorMessage: document.getElementById('loginErrorMessage'),
    registerErrorMessage: document.getElementById('registerErrorMessage')
};

// Task management functions
async function createTask(taskData) {
    try {
        const task = await tasksAPI.create(taskData);
        state.tasks.push(task);
        renderBoard();
        showToast('Task created successfully', 'success');
        return task;
    } catch (error) {
        console.error('Error creating task:', error);
        showToast('Failed to create task', 'error');
        throw error;
    }
}

async function updateTask(id, updates) {
    try {
        const updatedTask = await tasksAPI.update(id, updates);
        const index = state.tasks.findIndex(t => t.id === id);
        if (index !== -1) {
            state.tasks[index] = { ...state.tasks[index], ...updatedTask };
            renderBoard();
            showToast('Task updated successfully', 'success');
        }
        return updatedTask;
    } catch (error) {
        console.error('Error updating task:', error);
        showToast('Failed to update task', 'error');
        throw error;
    }
}

async function deleteTask(id) {
    try {
        await tasksAPI.delete(id);
        state.tasks = state.tasks.filter(task => task.id !== id);
        renderBoard();
        showToast('Task deleted', 'success');
        return true;
    } catch (error) {
        console.error('Error deleting task:', error);
        showToast('Failed to delete task', 'error');
        throw error;
    }
}

// Render the board with tasks
function renderBoard() {
    if (!DOM.board) return;
    
    // Clear the board
    DOM.board.innerHTML = '';
    
    // Filter and sort tasks
    let filteredTasks = [...state.tasks];
    
    // Apply search filter
    if (state.filterQuery) {
        const query = state.filterQuery.toLowerCase();
        filteredTasks = filteredTasks.filter(task => 
            task.title.toLowerCase().includes(query) || 
            (task.description && task.description.toLowerCase().includes(query))
        );
    }
    
    // Apply priority filter
    if (state.priorityFilter !== 'all') {
        filteredTasks = filteredTasks.filter(task => task.priority === state.priorityFilter);
    }
    
    // Apply sorting
    if (state.sortOrder !== 'none') {
        filteredTasks.sort((a, b) => {
            if (state.sortOrder === 'asc') {
                return new Date(a.dueDate) - new Date(b.dueDate);
            } else {
                return new Date(b.dueDate) - new Date(a.dueDate);
            }
        });
    }
    
    // Group tasks by status
    const tasksByStatus = {
        todo: filteredTasks.filter(task => task.status === 'todo'),
        progress: filteredTasks.filter(task => task.status === 'progress'),
        done: filteredTasks.filter(task => task.status === 'done')
    };
    
    // Create columns for each status
    const statuses = [
        { id: 'todo', title: 'To Do', icon: 'clipboard-list' },
        { id: 'progress', title: 'In Progress', icon: 'spinner' },
        { id: 'done', title: 'Done', icon: 'check-circle' }
    ];
    
    statuses.forEach(status => {
        const column = document.createElement('div');
        column.className = 'column';
        column.dataset.status = status.id;
        
        const tasks = tasksByStatus[status.id] || [];
        
        column.innerHTML = `
            <div class="column-header">
                <h3>
                    <i class="fas fa-${status.icon}"></i>
                    ${status.title}
                    <span class="task-count">${tasks.length}</span>
                </h3>
                <button class="add-task-btn" data-status="${status.id}" aria-label="Add task to ${status.title}">
                    <i class="fas fa-plus"></i>
                </button>
            </div>
            <div class="task-list" data-status="${status.id}">
                ${tasks.map(task => createTaskCard(task)).join('')}
            </div>
        `;
        
        DOM.board.appendChild(column);
    });
    
    // Make tasks draggable
    setupDragAndDrop();
}

// Create HTML for a task card
function createTaskCard(task) {
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';
    
    return `
        <div class="task-card ${isOverdue ? 'overdue' : ''} ${task.pinned ? 'pinned' : ''}" 
             data-task-id="${task.id}" draggable="true">
            <div class="task-header">
                <h4 class="task-title">${escapeHtml(task.title)}</h4>
                <div class="task-actions">
                    <button class="icon-btn pin-task" data-id="${task.id}" title="${task.pinned ? 'Unpin' : 'Pin'}">
                        <i class="fas fa-thumbtack ${task.pinned ? 'pinned' : ''}"></i>
                    </button>
                    <button class="icon-btn edit-task" data-id="${task.id}" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="icon-btn delete-task" data-id="${task.id}" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            ${task.description ? `<p class="task-description">${escapeHtml(task.description)}</p>` : ''}
            
            ${task.subtasks && task.subtasks.length > 0 ? `
                <div class="task-progress">
                    <div class="progress-bar">
                        <div class="progress" style="width: ${getTaskProgress(task)}%"></div>
                    </div>
                    <span>${getCompletedSubtasksCount(task)}/${task.subtasks.length} completed</span>
                </div>
            ` : ''}
            
            <div class="task-footer">
                <span class="task-priority ${task.priority}">${task.priority}</span>
                ${dueDate ? `
                    <span class="task-due-date ${isOverdue ? 'overdue' : ''}">
                        <i class="far fa-calendar-alt"></i>
                        ${formatDate(dueDate)}
                    </span>
                ` : ''}
            </div>
        </div>
    `;
}

// Helper functions
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

function getTaskProgress(task) {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    const completed = task.subtasks.filter(subtask => subtask.completed).length;
    return Math.round((completed / task.subtasks.length) * 100);
}

function getCompletedSubtasksCount(task) {
    if (!task.subtasks) return 0;
    return task.subtasks.filter(subtask => subtask.completed).length;
}

// Setup drag and drop functionality
function setupDragAndDrop() {
    const draggables = document.querySelectorAll('.task-card');
    const containers = document.querySelectorAll('.task-list');
    
    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', () => {
            draggable.classList.add('dragging');
        });
        
        draggable.addEventListener('dragend', async () => {
            draggable.classList.remove('dragging');
            
            // Get the new status from the container
            const container = draggable.closest('.task-list');
            if (container) {
                const newStatus = container.dataset.status;
                const taskId = draggable.dataset.taskId;
                
                // Update task status if it has changed
                const task = state.tasks.find(t => t.id === taskId);
                if (task && task.status !== newStatus) {
                    try {
                        await updateTask(taskId, { status: newStatus });
                    } catch (error) {
                        // If update fails, revert the UI
                        renderBoard();
                    }
                }
            }
        });
    });
    
    containers.forEach(container => {
        container.addEventListener('dragover', e => {
            e.preventDefault();
            const afterElement = getDragAfterElement(container, e.clientY);
            const draggable = document.querySelector('.dragging');
            
            if (afterElement == null) {
                container.appendChild(draggable);
            } else {
                container.insertBefore(draggable, afterElement);
            }
        });
    });
    
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
}

// Setup event listeners
function setupEventListeners() {
    // Task form submission
    if (DOM.taskForm) {
        DOM.taskForm.addEventListener('submit', handleTaskFormSubmit);
    }
    
    // Add subtask button
    if (DOM.addSubtaskBtn) {
        DOM.addSubtaskBtn.addEventListener('click', addSubtask);
    }
    
    // New subtask input (Enter key)
    if (DOM.newSubtaskInput) {
        DOM.newSubtaskInput.addEventListener('keypress', e => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addSubtask();
            }
        });
    }
    
    // Search input
    if (DOM.searchInput) {
        DOM.searchInput.addEventListener('input', e => {
            state.filterQuery = e.target.value.trim();
            renderBoard();
        });
    }
    
    // Priority filter
    if (DOM.priorityFilter) {
        DOM.priorityFilter.addEventListener('change', e => {
            state.priorityFilter = e.target.value;
            renderBoard();
        });
    }
    
    // Clear board button
    if (DOM.clearBoardBtn) {
        DOM.clearBoardBtn.addEventListener('click', () => {
            showModal('clearBoardModal');
        });
    }
    
    // Confirm clear board
    if (DOM.confirmClearBoardBtn) {
        DOM.confirmClearBoardBtn.addEventListener('click', async () => {
            try {
                // Delete all tasks
                await Promise.all(state.tasks.map(task => tasksAPI.delete(task.id)));
                state.tasks = [];
                renderBoard();
                hideModal('clearBoardModal');
                showToast('Board cleared successfully', 'success');
            } catch (error) {
                console.error('Error clearing board:', error);
                showToast('Failed to clear board', 'error');
            }
        });
    }
    
    // Cancel clear board
    if (DOM.cancelClearBoardBtn) {
        DOM.cancelClearBoardBtn.addEventListener('click', () => {
            hideModal('clearBoardModal');
        });
    }
    
    // Task actions (edit, delete, pin) - using event delegation
    document.addEventListener('click', async e => {
        // Edit task
        const editBtn = e.target.closest('.edit-task, .task-card');
        if (editBtn) {
            e.preventDefault();
            const taskId = editBtn.dataset.id || editBtn.closest('[data-task-id]')?.dataset.taskId;
            if (taskId) {
                openTaskModal(taskId);
            }
        }
        
        // Delete task
        const deleteBtn = e.target.closest('.delete-task');
        if (deleteBtn) {
            e.preventDefault();
            const taskId = deleteBtn.dataset.id;
            if (taskId) {
                state.taskToDelete = taskId;
                showModal('deleteConfirmModal');
            }
        }
        
        // Pin/unpin task
        const pinBtn = e.target.closest('.pin-task, .fa-thumbtack');
        if (pinBtn) {
            e.preventDefault();
            e.stopPropagation();
            const taskId = pinBtn.closest('[data-id]')?.dataset.id;
            if (taskId) {
                const task = state.tasks.find(t => t.id === taskId);
                if (task) {
                    await updateTask(taskId, { pinned: !task.pinned });
                }
            }
        }
        
        // Add task button
        const addTaskBtn = e.target.closest('.add-task-btn, .add-task-btn i');
        if (addTaskBtn) {
            e.preventDefault();
            const status = addTaskBtn.closest('[data-status]')?.dataset.status || 'todo';
            openTaskModal(null, status);
        }
    });
    
    // Confirm delete task
    if (DOM.confirmDeleteBtn) {
        DOM.confirmDeleteBtn.addEventListener('click', async () => {
            if (state.taskToDelete) {
                await deleteTask(state.taskToDelete);
                state.taskToDelete = null;
                hideModal('deleteConfirmModal');
            }
        });
    }
    
    // Cancel delete task
    if (DOM.cancelDeleteBtn) {
        DOM.cancelDeleteBtn.addEventListener('click', () => {
            state.taskToDelete = null;
            hideModal('deleteConfirmModal');
        });
    }
    
    // Close modals when clicking outside
    document.addEventListener('click', e => {
        if (e.target.classList.contains('modal-overlay')) {
            const modalId = e.target.id;
            if (modalId) {
                hideModal(modalId);
            }
        }
    });
    
    // Close modals with Escape key
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal-overlay[style*="display: flex"]');
            if (activeModal) {
                hideModal(activeModal.id);
            }
        }
    });
}

// Task form handling
async function handleTaskFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(DOM.taskForm);
    const taskData = {
        title: formData.get('title'),
        description: formData.get('description'),
        priority: formData.get('priority'),
        status: formData.get('status'),
        dueDate: formData.get('dueDate') || null,
        subtasks: getSubtasksFromForm()
    };
    
    const taskId = DOM.taskId.value;
    
    try {
        if (taskId) {
            // Update existing task
            await updateTask(taskId, taskData);
        } else {
            // Create new task
            await createTask(taskData);
        }
        
        hideModal('modalOverlay');
    } catch (error) {
        console.error('Error saving task:', error);
    }
}

// Open task modal for editing or creating a task
function openTaskModal(taskId = null, status = 'todo') {
    if (taskId) {
        // Edit existing task
        const task = state.tasks.find(t => t.id === taskId);
        if (task) {
            DOM.taskId.value = task.id;
            DOM.taskTitle.value = task.title || '';
            DOM.taskDesc.value = task.description || '';
            DOM.taskPriority.value = task.priority || 'medium';
            DOM.taskStatus.value = task.status || 'todo';
            DOM.taskDueDate.value = task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '';
            
            // Set up subtasks
            renderSubtasks(task.subtasks || []);
            
            // Update modal title
            document.getElementById('modalTitle').textContent = 'Edit Task';
        }
    } else {
        // Create new task
        DOM.taskForm.reset();
        DOM.taskId.value = '';
        DOM.taskStatus.value = status;
        renderSubtasks([]);
        
        // Update modal title
        document.getElementById('modalTitle').textContent = 'New Task';
    }
    
    // Show the modal
    showModal('modalOverlay');
    
    // Focus the title field
    setTimeout(() => {
        DOM.taskTitle.focus();
    }, 100);
}

// Subtasks management
function renderSubtasks(subtasks) {
    if (!DOM.subtasksContainer) return;
    
    DOM.subtasksContainer.innerHTML = subtasks.map((subtask, index) => `
        <div class="subtask" data-index="${index}">
            <input type="checkbox" id="subtask-${index}" ${subtask.completed ? 'checked' : ''}>
            <label for="subtask-${index}">${escapeHtml(subtask.text)}</label>
            <button type="button" class="delete-subtask" data-index="${index}" aria-label="Delete subtask">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');
    
    // Add event listeners for subtask checkboxes
    document.querySelectorAll('.subtask input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            // Update the subtask completed status in the UI
            const subtaskIndex = parseInt(checkbox.closest('.subtask').dataset.index);
            const subtasks = getSubtasksFromForm();
            if (subtaskIndex >= 0 && subtaskIndex < subtasks.length) {
                subtasks[subtaskIndex].completed = checkbox.checked;
            }
        });
    });
    
    // Add event listeners for delete subtask buttons
    document.querySelectorAll('.delete-subtask').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const subtaskIndex = parseInt(button.closest('.subtask').dataset.index);
            const subtasks = getSubtasksFromForm();
            if (subtaskIndex >= 0 && subtaskIndex < subtasks.length) {
                subtasks.splice(subtaskIndex, 1);
                renderSubtasks(subtasks);
            }
        });
    });
}

function addSubtask() {
    if (!DOM.newSubtaskInput || !DOM.subtasksContainer) return;
    
    const text = DOM.newSubtaskInput.value.trim();
    if (!text) return;
    
    const subtasks = getSubtasksFromForm();
    subtasks.push({ text, completed: false });
    
    renderSubtasks(subtasks);
    
    // Clear and focus the input
    DOM.newSubtaskInput.value = '';
    DOM.newSubtaskInput.focus();
}

function getSubtasksFromForm() {
    if (!DOM.subtasksContainer) return [];
    
    return Array.from(DOM.subtasksContainer.querySelectorAll('.subtask')).map(subtaskEl => {
        const checkbox = subtaskEl.querySelector('input[type="checkbox"]');
        const label = subtaskEl.querySelector('label');
        
        return {
            text: label ? label.textContent : '',
            completed: checkbox ? checkbox.checked : false
        };
    });
}

// Export functions needed by other modules
export { setupEventListeners, renderBoard };
