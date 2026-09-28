// Promotes an existing Auth user to super admin: admins/{uid}.role = "super" (T08).
// Usage: npx tsx scripts/bootstrap-super-admin.ts --project <id> --email <e> [--apply]
// Dry-run by default; see scripts/lib/cli.ts for the target guard.
import { initializeApp } from 'firebase-admin/app';
import { getAuth, type UserRecord } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { guardTarget, parseArgs } from './lib/cli';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), {
    email: { type: 'string' },
    project: { type: 'string' },
    apply: { type: 'boolean' },
  });
  const { project, apply } = guardTarget({ project: args.project, apply: args.apply });
  const email = args.email?.trim();
  if (!email) {
    console.error('--email is required');
    process.exit(2);
  }

  initializeApp({ projectId: project });
  const db = getFirestore();

  let userRecord: UserRecord;
  try {
    userRecord = await getAuth().getUserByEmail(email);
  } catch (error) {
    if ((error as { code?: unknown }).code === 'auth/user-not-found') {
      console.error('User not found');
      process.exit(1);
    }
    throw error;
  }
  const uid = userRecord.uid;

  const users = (await db.doc(`users/${uid}`).get()).data() ?? {};
  const adminRef = db.doc(`admins/${uid}`);
  const adminSnap = await adminRef.get();

  if (adminSnap.exists && adminSnap.get('role') === 'super') {
    console.log(`already super: uid=${uid}`);
    return;
  }

  const data: Record<string, unknown> = {
    email: userRecord.email ?? email,
    username: users.username || userRecord.displayName || 'user',
    photoURL: users.profilePictureURL || users.photoURL || userRecord.photoURL || '',
    addedBy: uid,
    role: 'super',
  };
  // Merge keeps an existing doc's original addedAt.
  if (!adminSnap.exists) data.addedAt = FieldValue.serverTimestamp();

  const shown = { ...data, ...(adminSnap.exists ? {} : { addedAt: '<serverTimestamp>' }) };
  console.log(
    `PLAN: set admins/${uid} (merge; doc ${adminSnap.exists ? `exists, role=${String(adminSnap.get('role') ?? '<none>')}` : 'missing'}):`,
  );
  console.log(JSON.stringify(shown, null, 2));

  if (!apply) {
    console.log('dry-run: nothing written (pass --apply to write)');
    return;
  }
  await adminRef.set(data, { merge: true });
  console.log(`applied: uid=${uid} is now super admin`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
