import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Make auth functions available globally
window.firebaseAuth = auth;
window.firebaseSignIn = signInWithEmailAndPassword;
window.firebaseSignUp = createUserWithEmailAndPassword;

// Handle auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    const token = await user.getIdToken();
    localStorage.setItem("token", token);
    console.log("User logged in:", user.email);
  } else {
    localStorage.removeItem("token");
    console.log("User logged out");
  }
});
