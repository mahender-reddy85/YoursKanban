import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  signOut as firebaseSignOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
let app;
let auth;

try {
  // Initialize Firebase app
  app = initializeApp(firebaseConfig);
  
  // Initialize Firebase Authentication
  auth = getAuth(app);
  
  // Make auth and auth functions available globally
  window.firebaseAuth = auth;
  window.firebaseSignIn = signInWithEmailAndPassword;
  window.firebaseSignUp = createUserWithEmailAndPassword;
  window.firebaseSignOut = firebaseSignOut;
  
  console.log('Firebase initialized successfully');
  
  // Set up auth state change listener
  onAuthStateChanged(auth, async (user) => {
    try {
      if (user) {
        // User is signed in
        const token = await user.getIdToken();
        localStorage.setItem("token", token);
        
        // Store user data in localStorage
        const userData = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email.split('@')[0],
          photoURL: user.photoURL
        };
        localStorage.setItem('user', JSON.stringify(userData));
        
        console.log('User logged in:', userData);
        
        // Dispatch custom event for other parts of the app
        document.dispatchEvent(new CustomEvent('userLoggedIn', { detail: userData }));
      } else {
        // User is signed out
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        console.log('User logged out');
        
        // Dispatch custom event for other parts of the app
        document.dispatchEvent(new CustomEvent('userLoggedOut'));
      }
    } catch (error) {
      console.error('Error in auth state change:', error);
    }
  });
  
} catch (error) {
  console.error('Firebase initialization error:', error);
  
  // Fallback if Firebase fails to initialize
  window.firebaseAuth = {
    signOut: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return Promise.resolve();
    }
  };
  
  window.firebaseSignIn = () => Promise.reject(new Error('Firebase not initialized'));
  window.firebaseSignUp = () => Promise.reject(new Error('Firebase not initialized'));
  window.firebaseSignOut = () => Promise.resolve();
}
