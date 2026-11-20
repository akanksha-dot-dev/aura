/**
 * firebaseAdmin.ts — Firebase Admin SDK Singleton
 * Server-side only. Replaces Agora credential system.
 * All API routes using this MUST set: export const runtime = 'nodejs'
 */
import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp(): App {
  if (getApps().length > 0) return getApps()[0]!;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const databaseURL =
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    `https://${projectId || 'aura-dev-default-rtdb'}.firebaseio.com`;
  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[FirebaseAdmin] Service account not configured. Using dev-mode fallback.');
    return initializeApp({ projectId: projectId || 'aura-dev', databaseURL });
  }
  return initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), databaseURL });
}

export const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getDatabase(adminApp);
export const adminFirestore = getFirestore(adminApp);
