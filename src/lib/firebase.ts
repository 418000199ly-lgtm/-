import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "autonomous-abbey-nnzsc",
  appId: "1:270773766200:web:7b3caa1df6822ed079fecd",
  apiKey: "AIzaSyD1VHQ2AL0NklJCJCjy4EFqIs2HrqMy4RQ",
  authDomain: "autonomous-abbey-nnzsc.firebaseapp.com",
  storageBucket: "autonomous-abbey-nnzsc.firebasestorage.app",
  messagingSenderId: "270773766200"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom settings to enforce long polling, bypassing iframe WebSocket limits
const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, "ai-studio-8c2c2304-5251-4eae-b3b7-9bbf375467a5");

export { app, db };

