import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDQx0Jq6BglTBel-IqXAA_lo8BWNMA3IjQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'jefinvestment-e1fc1.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'jefinvestment-e1fc1',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'jefinvestment-e1fc1.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1088168942774',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1088168942774:web:dc5461bed599c344f3da17',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-9J35QQ7V6C'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const storage = getStorage(app);

// Initialize Firestore with persistent cache for offline capabilities
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Secondary app for user creation so admin doesn't get signed out
const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

// Firebase Functions
const functions = getFunctions(app);

export { app, auth, db, storage, secondaryApp, secondaryAuth, functions };
