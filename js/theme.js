// Theme Manager
const ThemeManager = (() => {
    const STORAGE_KEY = 'kanbanflow_theme';
    const THEME_ATTR = 'data-theme';
    let currentTheme = localStorage.getItem(STORAGE_KEY) || 'light';
    let systemPreferenceQuery = window.matchMedia('(prefers-color-scheme: dark)');

    // Initialize theme
    function init() {
        // Set initial theme
        setTheme(currentTheme);
        
        // Listen for system theme changes
        systemPreferenceQuery.addEventListener('change', handleSystemThemeChange);
        
        // Set up theme toggle button
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', toggleTheme);
            themeToggle.setAttribute('aria-label', `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`);
        }
    }

    // Toggle between light and dark theme
    function toggleTheme() {
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        
        // Update button aria-label
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.setAttribute('aria-label', `Switch to ${currentTheme === 'dark' ? 'light' : 'dark'} mode`);
        }
        
        return newTheme;
    }

    // Set theme
    function setTheme(theme) {
        // Validate theme
        if (theme !== 'light' && theme !== 'dark') {
            theme = 'light'; // Default to light theme if invalid
        }
        
        // Update current theme
        currentTheme = theme;
        
        // Update HTML attribute
        document.documentElement.setAttribute(THEME_ATTR, theme);
        
        // Save to localStorage
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (error) {
            console.error('Error saving theme preference:', error);
        }
        
        // Dispatch custom event
        const event = new CustomEvent('themeChange', { detail: { theme } });
        document.dispatchEvent(event);
    }

    // Get current theme
    function getTheme() {
        return currentTheme;
    }

    // Handle system theme changes
    function handleSystemThemeChange(e) {
        // Only apply system theme if user hasn't explicitly set a preference
        if (!localStorage.getItem(STORAGE_KEY)) {
            const newTheme = e.matches ? 'dark' : 'light';
            if (newTheme !== currentTheme) {
                setTheme(newTheme);
            }
        }
    }

    // Check if dark mode is preferred by the system
    function prefersDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Clean up event listeners
    function destroy() {
        systemPreferenceQuery.removeEventListener('change', handleSystemThemeChange);
        
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.removeEventListener('click', toggleTheme);
        }
    }

    return {
        init,
        toggleTheme,
        setTheme,
        getTheme,
        destroy,
        prefersDarkMode
    };
})();

export { ThemeManager };
