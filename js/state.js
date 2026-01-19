// Application state
export const state = {
    tasks: [],
    currentUser: null,
    isAuthenticated: false,
    theme: localStorage.getItem('kanbanflow_theme') || 'light',
    filterQuery: '',
    priorityFilter: 'all',
    sortOrder: 'none',
    lastDeletedTask: null
};
