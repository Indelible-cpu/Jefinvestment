import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

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

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || '6Ld1VKctAAAAAKumuGcc_7c7M7kn_EE9evkv7Duo';

// Initialize Firebase App Check with reCAPTCHA Enterprise
if (typeof window !== 'undefined' && recaptchaSiteKey) {
  if (import.meta.env.DEV) {
    // In local development, enable debug token to prevent local requests from failing
    // @ts-ignore
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaSiteKey),
      isTokenAutoRefreshEnabled: true
    });
  } catch (err) {
    console.warn('App Check initialization failed:', err);
  }
}

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

export { app, auth, db, storage, secondaryApp, secondaryAuth };
