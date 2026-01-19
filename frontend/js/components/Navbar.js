import { authAPI } from '../../src/api.js';

export default class Navbar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.user = null;
  }

  async connectedCallback() {
    try {
      console.log('Fetching user data...');
      this.user = await authAPI.getMe();
      console.log('User data:', this.user);
      this.render();
    } catch (error) {
      console.log('User not authenticated, showing auth buttons');
      this.user = null;
      this.render();
    }
  }

  handleLogout() {
    authAPI.logout();
  }

  render() {
    console.log('Rendering Navbar, user:', this.user);
    // Force show buttons for testing - remove this line after debugging
    const isAuthenticated = false; // Temporarily force show auth buttons
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background-color: var(--bg-secondary);
          box-shadow: var(--shadow-sm);
          position: sticky;
          top: 0;
          z-index: 100;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        
        nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1.5rem;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }
        
        .logo {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--primary);
          text-decoration: none;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .nav-links {
          display: flex;
          align-items: center;
          gap: 1.5rem;
        }
        
        .nav-link {
          color: var(--text-muted);
          text-decoration: none;
          font-weight: 500;
          font-size: 0.9375rem;
          transition: color 0.2s ease;
        }
        
        .nav-link:hover {
          color: var(--primary);
        }
        
        .user-menu {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: var(--primary);
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          font-size: 0.875rem;
        }
        
        /* Auth Section */
        .auth-section {
          background-color: var(--bg-primary);
          padding: 1.5rem 1rem;
          text-align: center;
          border-bottom: 1px solid var(--border-color);
        }
        
        .auth-buttons {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin-top: 0.5rem;
        }
        
        .auth-buttons .btn-auth {
          min-width: 140px;
          text-align: center;
          padding: 0.75rem 1.5rem;
          font-size: 1rem;
          font-weight: 500;
          border-radius: 6px;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
        }
        
        .btn-auth {
          padding: 0.5rem 1rem;
          border-radius: var(--radius-sm);
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        
        .btn-login {
          background: none;
          border: 1px solid var(--primary);
          color: var(--primary);
        }
        
        .btn-login:hover {
          background-color: var(--primary-light);
        }
        
        .btn-signup {
          background-color: var(--primary);
          border: 1px solid var(--primary);
          color: white;
        }
        
        .btn-signup:hover {
          background-color: var(--primary-dark);
          border-color: var(--primary-dark);
        }
        
        .btn-logout {
          background: none;
          border: 1px solid var(--border-color);
          color: var(--text-main);
          padding: 0.5rem 1rem;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }
        
        .btn-logout:hover {
          background-color: var(--bg-primary);
        }
      </style>
      
      <div style="background: #f8f9fa; padding: 1rem; border-bottom: 1px solid #e9ecef;">
        <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
          <a href="/" style="display: flex; align-items: center; text-decoration: none; color: #333; font-weight: bold; font-size: 1.25rem;">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 0.5rem;">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            YoursKanban
          </a>
        </div>
      </div>
      <div style="background: #fff; padding: 2rem 1rem; text-align: center; border-bottom: 1px solid #e9ecef;">
        <h3 style="margin: 0 0 1.5rem 0; color: #333; font-size: 1.5rem;">Get Started with YoursKanban</h3>
        <div style="display: flex; justify-content: center; gap: 1rem; flex-wrap: wrap;">
          <a href="/login" style="display: inline-flex; align-items: center; gap: 0.5rem; background: #4CAF50; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; font-weight: 500; transition: background 0.2s ease;">
            <span>✅</span> Login
          </a>
          <a href="/register" style="display: inline-flex; align-items: center; gap: 0.5rem; background: #2196F3; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; font-weight: 500; transition: background 0.2s ease;">
            <span>✅</span> Sign Up
          </a>
        </div>
      </div>
    `;

    // Add event listeners
    const logoutBtn = this.shadowRoot.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
  }
}

// Define the custom element
if (!customElements.get('app-navbar')) {
  customElements.define('app-navbar', Navbar);
}
