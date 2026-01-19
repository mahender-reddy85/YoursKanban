import { authAPI } from '../../src/api.js';

export default class Navbar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.user = null;
  }

  async connectedCallback() {
    try {
      this.user = await authAPI.getMe();
      this.render();
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  handleLogout() {
    authAPI.logout();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background-color: var(--bg-secondary);
          box-shadow: var(--shadow-sm);
          position: sticky;
          top: 0;
          z-index: 100;
        }
        
        nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 2rem;
          max-width: 1200px;
          margin: 0 auto;
          width: 100%;
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
        
        .btn-logout {
          background: none;
          border: 1px solid var(--border-color);
          color: var(--text-main);
          padding: 0.375rem 0.75rem;
          border-radius: var(--radius-sm);
          cursor: pointer;
          font-size: 0.875rem;
          transition: all 0.2s ease;
        }
        
        .btn-logout:hover {
          background-color: var(--bg-primary);
        }
      </style>
      
      <nav>
        <a href="/" class="logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="3" y1="9" x2="21" y2="9"></line>
            <line x1="9" y1="21" x2="9" y2="9"></line>
          </svg>
          YoursKanban
        </a>
        
        ${this.user ? `
          <div class="nav-links">
            <a href="/" class="nav-link">Dashboard</a>
            <a href="/boards" class="nav-link">Boards</a>
            <a href="/profile" class="nav-link">Profile</a>
          </div>
          
          <div class="user-menu">
            <div class="user-avatar">
              ${this.user.name ? this.user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <button class="btn-logout">Logout</button>
          </div>
        ` : `
          <div class="nav-links">
            <a href="/login.html" class="nav-link">Login</a>
            <a href="/register.html" class="btn btn-primary">Sign Up</a>
          </div>
        `}
      </nav>
    `;

    // Add event listeners
    const logoutBtn = this.shadowRoot.querySelector('.btn-logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
  }
}

// Define the custom element
if (!customElements.get('app-navbar')) {
  customElements.define('app-navbar', Navbar);
}
