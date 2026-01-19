import { createContext, useContext, useReducer, useEffect } from 'react';

export const KanbanContext = createContext();

// Initial state matching the original state object
const initialState = {
  tasks: [],
  theme: 'light',
  filterQuery: '',
  priorityFilter: 'all',
  sortOrder: 'none',
  lastDeletedTask: null,
  currentUser: null,
  isLoading: true,
  error: null
};

// Reducer function to handle state updates
function kanbanReducer(state, action) {
  switch (action.type) {
    case 'SET_TASKS':
      return { ...state, tasks: action.payload };
    case 'ADD_TASK':
      return { ...state, tasks: [...state.tasks, action.payload] };
    case 'UPDATE_TASK':
      return {
        ...state,
        tasks: state.tasks.map(task => 
          task.id === action.payload.id ? { ...task, ...action.payload } : task
        )
      };
    case 'DELETE_TASK':
      return {
        ...state,
        tasks: state.tasks.filter(task => task.id !== action.payload),
        lastDeletedTask: state.tasks.find(task => task.id === action.payload) || null
      };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'SET_FILTER_QUERY':
      return { ...state, filterQuery: action.payload };
    case 'SET_PRIORITY_FILTER':
      return { ...state, priorityFilter: action.payload };
    case 'SET_SORT_ORDER':
      return { ...state, sortOrder: action.payload };
    case 'SET_CURRENT_USER':
      return { ...state, currentUser: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

export const KanbanProvider = ({ children }) => {
  const [state, dispatch] = useReducer(kanbanReducer, initialState);

  // Load saved theme from localStorage on initial render
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('kanbanflow_theme');
      if (savedTheme) {
        dispatch({ type: 'SET_THEME', payload: savedTheme });
      }
    } catch (error) {
      console.error('Error accessing localStorage:', error);
    }
  }, []);

  // Save theme to localStorage when it changes
  useEffect(() => {
    try {
      localStorage.setItem('kanbanflow_theme', state.theme);
      document.documentElement.setAttribute('data-theme', state.theme);
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }, [state.theme]);

  // Context value containing state and actions
  const value = {
    ...state,
    // Actions
    setTasks: (tasks) => dispatch({ type: 'SET_TASKS', payload: tasks }),
    addTask: (task) => dispatch({ type: 'ADD_TASK', payload: task }),
    updateTask: (id, updates) => dispatch({ 
      type: 'UPDATE_TASK', 
      payload: { id, ...updates } 
    }),
    deleteTask: (id) => dispatch({ type: 'DELETE_TASK', payload: id }),
    setTheme: (theme) => dispatch({ type: 'SET_THEME', payload: theme }),
    setFilterQuery: (query) => dispatch({ type: 'SET_FILTER_QUERY', payload: query }),
    setPriorityFilter: (filter) => dispatch({ type: 'SET_PRIORITY_FILTER', payload: filter }),
    setSortOrder: (order) => dispatch({ type: 'SET_SORT_ORDER', payload: order }),
    setCurrentUser: (user) => dispatch({ type: 'SET_CURRENT_USER', payload: user }),
    setLoading: (isLoading) => dispatch({ type: 'SET_LOADING', payload: isLoading }),
    setError: (error) => dispatch({ type: 'SET_ERROR', payload: error }),
  };

  return (
    <KanbanContext.Provider value={value}>
      {children}
    </KanbanContext.Provider>
  );
}

export function useKanban() {
  const context = useContext(KanbanContext);
  if (!context) {
    throw new Error('useKanban must be used within a KanbanProvider');
  }
  return context;
}

export default KanbanContext;
