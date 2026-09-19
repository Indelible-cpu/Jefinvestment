import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';
import { getAnalytics, isSupported as isAnalyticsSupported, logEvent, type Analytics } from 'firebase/analytics';

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

// App Check is currently disabled to prevent auth/firebase-app-check-token-is-invalid
// errors across login, user creation, and password/PIN resets.
// If needed in the future, ensure the web app is properly registered in Firebase Console first.

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

// Lazily and safely initialize Firebase Messaging (checks browser/PWA support)
let messagingInstance: Messaging | null = null;
async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;
  try {
    const supported = await isSupported();
    if (supported) {
      messagingInstance = getMessaging(app);
      return messagingInstance;
    }
  } catch (e) {
    console.warn('Firebase Messaging is not supported in this browser/environment:', e);
  }
  return null;
}

// Safely initialize Firebase Analytics (Google Analytics)
let analyticsInstance: Analytics | null = null;
async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === 'undefined') return null;
  if (analyticsInstance) return analyticsInstance;
  try {
    const supported = await isAnalyticsSupported();
    if (supported && firebaseConfig.measurementId) {
      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    }
  } catch (e) {
    console.warn('Firebase Analytics is not supported in this environment:', e);
  }
  return null;
}

// Helper to log analytics events safely
async function trackAnalyticsEvent(eventName: string, eventParams?: Record<string, any>) {
  try {
    const analytics = await getFirebaseAnalytics();
    if (analytics) {
      logEvent(analytics, eventName, eventParams);
    }
  } catch (e) {
    // Non-blocking fail-safe
  }
}

export {
  app,
  auth,
  db,
  storage,
  secondaryApp,
  secondaryAuth,
  getFirebaseMessaging,
  getFirebaseAnalytics,
  trackAnalyticsEvent,
};

