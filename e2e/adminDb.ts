import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

/** Admin SDK Firestore on the emulator (demo-spoton only), for specs that set up or check data. */
export function adminDb() {
  if (!process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error('refusing to run: FIRESTORE_EMULATOR_HOST not set (run via firebase emulators:exec)');
  }
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== 'demo-spoton') {
    throw new Error('refusing to run: unexpected GCLOUD_PROJECT');
  }
  if (!getApps().length) initializeApp({ projectId: 'demo-spoton' });
  return getFirestore();
}
