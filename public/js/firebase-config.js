import { initializeApp } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-firestore.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.0.0/firebase-auth.js";

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
window._auth = getAuth(app);

// 匿名認証でサインイン
signInAnonymously(window._auth).catch((e) => {
  console.error("匿名認証エラー:", e);
});

// 認証状態の変化を監視
onAuthStateChanged(window._auth, (user) => {
  if (user) {
    window._uid = user.uid;
    console.log("認証完了 uid:", user.uid);
  }
});