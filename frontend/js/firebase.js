import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  onAuthStateChanged,
  signOut as firebaseSignOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCcM9b9yCBof3CtiwDyazp4AJWp0TIJT8U",
  authDomain: "yourskanban.firebaseapp.com",
  projectId: "yourskanban",
  storageBucket: "yourskanban.firebasestorage.app",
  messagingSenderId: "260698703143",
  appId: "1:260698703143:web:4c162e64d38633a70fd502",
  measurementId: "G-83PTLK1WFE"
};

// Initialize Firebase
export let app;
export let auth;
let analytics;

// Initialize Firebase
const initFirebase = () => {
  try {
    // Initialize Firebase app
    app = initializeApp(firebaseConfig);
    
    // Initialize Firebase services
    auth = getAuth(app);
    analytics = getAnalytics(app);
    
    // Make auth and auth functions available globally
    window.firebaseAuth = auth;
    window.firebaseSignIn = signInWithEmailAndPassword;
    window.firebaseSignUp = createUserWithEmailAndPassword;
    window.firebaseSignOut = firebaseSignOut;
    window.firebaseAnalytics = analytics;
    

    
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
          

        } else {
          // User is signed out
          localStorage.removeItem('user');
          localStorage.removeItem('token');

        }
      } catch (error) {
        console.error('Error in auth state change:', error);
      }
    });
    
    return { app, auth, analytics };
  } catch (error) {
    console.error('Firebase initialization error:', error);
    throw error;
  }
};

// Export a function to check if Firebase is initialized
export function isFirebaseInitialized() {
  return !!app && !!auth;
}

// Initialize Firebase immediately
const firebaseApp = initFirebase();

// Fallback if Firebase fails to initialize
if (!firebaseApp) {
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
