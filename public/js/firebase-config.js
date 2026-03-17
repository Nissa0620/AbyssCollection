import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC-Y2eOz2DcnCTgQvqOAmWq7_Y7Ay0gtjU",
  authDomain: "abyss-collection.firebaseapp.com",
  projectId: "abyss-collection",
  storageBucket: "abyss-collection.firebasestorage.app",
  messagingSenderId: "603356544315",
  appId: "1:603356544315:web:cb8242bd225aed184d4b1e"
};

const app = initializeApp(firebaseConfig);
window._db = getFirestore(app);
