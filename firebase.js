// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDvXhHA8eSOZ4A9juQtBWnc8poEcpw0CLQ",
    authDomain: "labtops-1861f.firebaseapp.com",
    projectId: "labtops-1861f",
    storageBucket: "labtops-1861f.appspot.com",
    messagingSenderId: "1045175731337",
    appId: "1:1045175731337:web:5e5a178241bdac02b13258"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Export the db to be used in other modules
export { db };
