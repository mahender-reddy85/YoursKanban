import { authAPI } from '../../src/api.js';

export default class Navbar extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.user = null;
    this.mobileMenuOpen = false;
    this.toggleMobileMenu = this.toggleMobileMenu.bind(this);
  }

  async connectedCallback() {
    try {
      this.user = await authAPI.getMe();
      this.render();
    } catch (error) {
      this.user = null;
      this.render();
    }
  }
  
  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
    this.render();
  }

  handleLogout() {
    authAPI.logout();
  }

  render() {
    const isAuthenticated = !!this.user;
    
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
        
        /* Auth Buttons */
        .auth-buttons {
          display: flex;
          gap: 0.75rem;
          align-items: center;
        }
        
        /* Mobile Menu Button */
        .mobile-menu-button {
          display: none;
          background: none;
          border: none;
          color: var(--text-main);
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
          margin-left: 0.5rem;
        }
        
        /* Mobile Menu */
        .mobile-menu {
          display: none;
          flex-direction: column;
          gap: 1rem;
          padding: 1rem 1.5rem;
          background-color: var(--bg-secondary);
          border-top: 1px solid var(--border-color);
        }
        
        .mobile-menu.open {
          display: flex;
        }
        
        /* Responsive Styles */
        @media (max-width: 768px) {
          .mobile-menu-button {
            display: block;
          }
          
          .auth-buttons {
            display: none;
          }
          
          .auth-buttons.mobile-visible {
            display: flex;
            flex-direction: column;
            width: 100%;
            gap: 0.75rem;
            padding: 0.5rem 0;
          }
          
          .auth-buttons.mobile-visible .btn-auth {
            width: 100%;
            justify-content: center;
          }
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
      
      <nav>
        <div class="nav-left">
          <a href="/" class="logo">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="3" y1="9" x2="21" y2="9"></line>
              <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
            <span>YoursKanban</span>
          </a>
        </div>
        
        <div class="nav-right">
          ${isAuthenticated ? `
            <div class="user-menu">
              <div class="user-avatar">${this.user.name ? this.user.name.charAt(0).toUpperCase() : 'U'}</div>
              <button class="btn-logout" id="logoutBtn">
                Logout
              </button>
            </div>
          ` : `
            <div class="auth-buttons">
              <a href="/login" class="btn-auth btn-login">
                Log In
              </a>
              <a href="/register" class="btn-auth btn-signup">
                Sign Up
              </a>
            </div>
            <button class="mobile-menu-button" id="mobileMenuButton">
              <i class="fas fa-bars"></i>
            </button>
          `}
        </div>
      </nav>
      
      ${!isAuthenticated ? `
        <div class="mobile-menu ${this.mobileMenuOpen ? 'open' : ''}" id="mobileMenu">
          <div class="auth-buttons mobile-visible">
            <a href="/login" class="btn-auth btn-login">
              Log In
            </a>
            <a href="/register" class="btn-auth btn-signup">
              Sign Up
            </a>
          </div>
        </div>
      ` : ''}
    `;

    // Add event listeners
    const logoutBtn = this.shadowRoot.getElementById('logoutBtn');
    const mobileMenuButton = this.shadowRoot.getElementById('mobileMenuButton');
    
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.handleLogout());
    }
    
    if (mobileMenuButton) {
      mobileMenuButton.addEventListener('click', this.toggleMobileMenu);
    }
  }
}

// Define the custom element
if (!customElements.get('app-navbar')) {
  customElements.define('app-navbar', Navbar);
}
