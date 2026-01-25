// Wait for Firebase to be available
function waitForFirebase() {
  return new Promise((resolve) => {
    if (window.firebaseAuth) {
      resolve();
    } else {
      const checkInterval = setInterval(() => {
        if (window.firebaseAuth) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
    }
  });
}

// Make functions globally available
window.openAuthModal = showAuthModal;
window.closeAuthModal = closeAuthModal;
window.handleLogout = handleLogout;

// Auth Modal Elements
const authModal = document.getElementById('authModal');
const loginForm = document.getElementById('loginForm');
const signupForm = document.getElementById('signupForm');
const switchToSignup = document.getElementById('switchToSignup');
const switchToLogin = document.getElementById('switchToLogin');
const authModalTitle = document.getElementById('authModalTitle');

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Wait for Firebase to be available
    await waitForFirebase();
    
    // Initialize auth components
    initializeAuthButtons();
    initializeAuthStateListener();
    initializeFormSubmissions();
    initializeModalSwitchers();
    
    console.log('Auth module initialized');
  } catch (error) {
    console.error('Error initializing auth module:', error);
    showToast('Error initializing authentication. Please refresh the page.', 'error');
  }
});

// Initialize auth buttons
function initializeAuthButtons() {
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  
  if (loginBtn) {
    loginBtn.onclick = (e) => {
      e.preventDefault();
      showAuthModal('login');
    };
  }
  
  if (signupBtn) {
    signupBtn.onclick = (e) => {
      e.preventDefault();
      showAuthModal('signup');
    };
  }
}

// Initialize form submissions
function initializeFormSubmissions() {
  // Login form
  const loginFormElement = document.getElementById('loginFormElement');
  if (loginFormElement) {
    loginFormElement.addEventListener('submit', handleLogin);
  }
  
  // Signup form
  const signupFormElement = document.getElementById('signupFormElement');
  if (signupFormElement) {
    signupFormElement.addEventListener('submit', handleSignup);
  }
}

// Initialize modal switchers
function initializeModalSwitchers() {
  if (switchToSignup) {
    switchToSignup.addEventListener('click', (e) => {
      e.preventDefault();
      showAuthModal('signup');
    });
  }
  
  if (switchToLogin) {
    switchToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      showAuthModal('login');
    });
  }
}

// Initialize auth state listener
function initializeAuthStateListener() {
  if (window.firebaseAuth) {
    window.firebaseAuth.onAuthStateChanged(handleAuthStateChange);
  }
}

// Show auth modal with specified form
function showAuthModal(formType = 'login') {
  if (formType === 'login') {
    showLoginModal();
  } else if (formType === 'signup') {
    showSignupModal();
  }
}

// Show auth modal with login form
function showLoginModal() {
  if (!authModal) return;
  
  authModal.style.display = 'flex';
  if (loginForm) loginForm.style.display = 'block';
  if (signupForm) signupForm.style.display = 'none';
  if (authModalTitle) authModalTitle.textContent = 'Login to Your Account';
  
  const emailInput = document.getElementById('authEmail');
  if (emailInput) emailInput.focus();
}

// Show auth modal with signup form
function showSignupModal() {
  if (!authModal) return;
  
  authModal.style.display = 'flex';
  if (loginForm) loginForm.style.display = 'none';
  if (signupForm) signupForm.style.display = 'block';
  if (authModalTitle) authModalTitle.textContent = 'Create New Account';
  
  const emailInput = document.getElementById('signupEmail');
  if (emailInput) emailInput.focus();
}

// Close auth modal
function closeAuthModal() {
  if (authModal) {
    authModal.style.display = 'none';
  }
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();
  
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const loginButton = document.getElementById('loginButton');
  
  if (!email || !password) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  try {
    loginButton.disabled = true;
    loginButton.textContent = 'Signing in...';
    
    // Sign in with Firebase
    await window.firebaseSignIn(window.firebaseAuth, email, password);
    
    // Update UI
    showToast('Logged in successfully', 'success');
    closeAuthModal();
    
  } catch (error) {
    console.error('Login error:', error);
    showToast(getAuthErrorMessage(error.code), 'error');
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = 'Sign In';
  }
}

// Handle signup form submission
async function handleSignup(e) {
  e.preventDefault();
  
  const name = document.getElementById('signupName').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const signupButton = document.getElementById('signupButton');
  
  // Validate form
  if (!name || !email || !password || !confirmPassword) {
    showToast('Please fill in all fields', 'error');
    return;
  }
  
  if (password !== confirmPassword) {
    showToast('Passwords do not match', 'error');
    return;
  }
  
  if (password.length < 6) {
    showToast('Password must be at least 6 characters', 'error');
    return;
  }
  
  try {
    signupButton.disabled = true;
    signupButton.textContent = 'Creating account...';
    
    // Create user with Firebase
    const userCredential = await window.firebaseSignUp(window.firebaseAuth, email, password);
    const user = userCredential.user;
    
    // Update user profile with display name
    await updateProfile(user, { displayName: name });
    
    // Update UI
    showToast('Account created successfully!', 'success');
    closeAuthModal();
    
    // Switch to login form
    showLoginModal();
    
  } catch (error) {
    console.error('Signup error:', error);
    showToast(getAuthErrorMessage(error.code), 'error');
  } finally {
    signupButton.disabled = false;
    signupButton.textContent = 'Sign Up';
  }
}

// Handle logout
async function handleLogout() {
  try {
    // Sign out from Firebase
    if (window.firebaseAuth) {
      await window.firebaseAuth.signOut();
      showToast('Logged out successfully', 'success');
      
      // Reload the page to update the UI
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  } catch (error) {
    console.error('Logout error:', error);
    showToast('Error logging out. Please try again.', 'error');
  }
}

// Handle auth state changes
function handleAuthStateChange(user) {
  const authButtons = document.querySelector('.auth-buttons');
  const userMenu = document.getElementById('userMenu');
  
  if (user) {
    // User is signed in
    const userData = {
      name: user.displayName || 'User',
      email: user.email || '',
      photoURL: user.photoURL || ''
    };
    
    // Update UI for logged-in user
    if (authButtons) authButtons.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    
    // Close auth modal if open
    closeAuthModal();
    
    // Show welcome message
    showToast(`Welcome back, ${userData.name}!`, 'success');
  } else {
    // User is signed out
    if (authButtons) authButtons.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
  }
}

// Get user-friendly error messages
function getAuthErrorMessage(errorCode) {
  const errorMessages = {
    'auth/email-already-in-use': 'This email is already in use. Please use a different email.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/operation-not-allowed': 'Email/password accounts are not enabled.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/too-many-requests': 'Too many failed attempts. Please try again later.'
  };
  
  return errorMessages[errorCode] || 'An error occurred. Please try again.';
}

// Show toast notification
function showToast(message, type = 'info') {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  toastContainer.appendChild(toast);
  
  // Show the toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Remove the toast after delay
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 3000);
}

// Close modal when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === authModal) {
    closeAuthModal();
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && authModal && authModal.style.display === 'flex') {
    closeAuthModal();
  }
});
window.addEventListener('click', (e) => {
  if (e.target === authModal) {
    closeAuthModal();
  }
});

// Handle login form submission
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('authEmail').value;
    const password = document.getElementById('authPassword').value;
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');
    
    try {
      loginBtn.disabled = true;
      loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
      
      const userCred = await firebaseSignIn(firebaseAuth, email, password);
      const token = await userCred.user.getIdToken();
      
      localStorage.setItem('token', token);
      
      // Show success message
      showToast('Login successful!', 'success');
      
      // Close modal and reload the page
      closeAuthModal();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (err) {
      console.error('Login error:', err);
      loginError.textContent = err.message;
      loginError.style.display = 'block';
      showToast(err.message, 'error');
    } finally {
      loginBtn.disabled = false;
      loginBtn.innerHTML = 'Login';
    }
  });
}

// Handle signup form submission
if (signupForm) {
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const signupBtn = document.getElementById('signupBtn');
    const signupError = document.getElementById('signupError');
    
    // Client-side validation
    if (password !== confirmPassword) {
      signupError.textContent = 'Passwords do not match';
      signupError.style.display = 'block';
      return;
    }
    
    if (password.length < 6) {
      signupError.textContent = 'Password must be at least 6 characters';
      signupError.style.display = 'block';
      return;
    }
    
    try {
      signupBtn.disabled = true;
      signupBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating account...';
      
      const userCred = await firebaseSignUp(firebaseAuth, email, password);
      const token = await userCred.user.getIdToken();
      
      localStorage.setItem('token', token);
      
      // Show success message
      showToast('Account created successfully!', 'success');
      
      // Close modal and reload the page
      closeAuthModal();
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (err) {
      console.error('Signup error:', err);
      signupError.textContent = err.message;
      signupError.style.display = 'block';
      showToast(err.message, 'error');
    } finally {
      signupBtn.disabled = false;
      signupBtn.innerHTML = 'Create Account';
    }
  });
}

// Handle logout
function handleLogout() {
  firebaseAuth.signOut().then(() => {
    localStorage.removeItem('token');
    showToast('Logged out successfully', 'success');
    window.location.reload();
  }).catch((error) => {
    console.error('Logout error:', error);
    showToast('Error logging out', 'error');
  });
}

// Check auth state
firebaseAuth.onAuthStateChanged((user) => {
  const authButtons = document.querySelector('.auth-buttons');
  const userMenu = document.getElementById('userMenu');
  const userEmail = document.getElementById('userEmail');
  
  if (user) {
    // User is signed in
    if (authButtons) authButtons.style.display = 'none';
    if (userMenu) userMenu.style.display = 'flex';
    if (userEmail) userEmail.textContent = user.email;
  } else {
    // User is signed out
    if (authButtons) authButtons.style.display = 'flex';
    if (userMenu) userMenu.style.display = 'none';
  }
});

// Toast notification function
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  
  const toastContainer = document.getElementById('toastContainer');
  if (toastContainer) {
    toastContainer.appendChild(toast);
    
    // Remove toast after delay
    setTimeout(() => {
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
          toast.remove();
        }, 300);
      }, 3000);
    }, 100);
  }
}
