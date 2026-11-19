/**
 * firebaseClient.ts — Firebase Client SDK Singleton (browser-side)
 * Replaces Agora App ID on client. Provides Realtime Database for
 * sub-100ms dashboard events (replaces Agora RTM 2.x Message Channels).
 */
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getDatabase, Database } from 'firebase/database';
import { getAuth, Auth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function isConfigured(): boolean {
  return !!(
    firebaseConfig.apiKey &&
    !firebaseConfig.apiKey.includes('AIza...') &&
    firebaseConfig.projectId &&
    !firebaseConfig.projectId.includes('your-project')
  );
}

let _app: FirebaseApp | null = null;
let _db: Database | null = null;
let _auth: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (typeof window === 'undefined') return null;
  if (!isConfigured()) return null;
  if (_app) return _app;
  _app = getApps().length > 0 ? getApps()[0]! : initializeApp(firebaseConfig, 'aura-client');
  return _app;
}

export function getFirebaseDb(): Database | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (_db) return _db;
  _db = getDatabase(app);
  return _db;
}

export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  if (_auth) return _auth;
  _auth = getAuth(app);
  return _auth;
}

export { isConfigured as isFirebaseConfigured };
