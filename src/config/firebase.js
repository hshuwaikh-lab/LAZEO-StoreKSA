import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-project',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '0',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '0:0:web:0',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase with comprehensive error handling
let app = null, auth = null, db = null, storage = null, analytics = null;
let initError = null;

try {
  // Check if we have real Firebase credentials (at least apiKey should not be 'demo-key')
  const hasRealConfig = import.meta.env.VITE_FIREBASE_API_KEY && 
                        import.meta.env.VITE_FIREBASE_API_KEY !== 'demo-key' &&
                        import.meta.env.VITE_FIREBASE_PROJECT_ID;
  
  if (!hasRealConfig) {
    console.warn('⚠️ Firebase: Environment variables not configured. App will work in demo mode.');
    initError = 'Firebase credentials not found';
  } else {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);

    // Initialize Analytics conditionally
    isSupported().then((supported) => {
      if (supported) {
        analytics = getAnalytics(app);
      }
    }).catch((err) => {
      console.warn("Firebase Analytics is not supported:", err);
    });
  }
} catch (error) {
  console.warn('⚠️ Firebase initialization failed:', error?.message || error);
  initError = error?.message || 'Firebase initialization error';
  // Keep app/auth/db/storage as null - they will be checked before use
}

export { app, auth, db, storage, analytics, initError };
