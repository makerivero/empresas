import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const defaultFirebaseConfig = {
  apiKey: "AIzaSyAALSLthu70dP1XEYmDTgWP8R5QdTxfH-I",
  authDomain: "tecnoempresas-5d449.firebaseapp.com",
  projectId: "tecnoempresas-5d449",
  storageBucket: "tecnoempresas-5d449.firebasestorage.app",
  messagingSenderId: "475364926554",
  appId: "1:475364926554:web:ffa65d86e534d8f00ce463",
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
};

export const firebaseReady = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
export const firebaseApp = firebaseReady ? initializeApp(firebaseConfig) : null;
export const auth = firebaseReady ? getAuth(firebaseApp) : null;
export const db = firebaseReady ? getFirestore(firebaseApp) : null;
export const storage = firebaseReady ? getStorage(firebaseApp) : null;
