// Backfills users.spotsCount, publicProfiles/{uid} and the usernames/{name} registry (T09).
// Usage: npx tsx scripts/backfill-profiles.ts --project <id> [--apply]
// Dry-run by default; see scripts/lib/cli.ts for the target guard. Read-only admins integrity check.
// Never rewrites users.username or admins; reports duplicate/conflicting/invalid usernames instead.
// Output contains uids and usernames only, never emails. Idempotent: a re-run after --apply plans 0.
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import {
  FieldPath,
  FieldValue,
  getFirestore,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { buildPublicProfile, normalizeUsername, profileFieldsEqual } from '../functions/src/lib/profiles';
import { guardTarget, parseArgs } from './lib/cli';

const PAGE_SIZE = 300;
const BATCH_LIMIT = 400;

type Write =
  | { kind: 'update'; ref: DocumentReference; data: Record<string, unknown> }
  | { kind: 'set-merge'; ref: DocumentReference; data: Record<string, unknown> }
  | { kind: 'create'; ref: DocumentReference; data: Record<string, unknown> };

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), {
    project: { type: 'string' },
    apply: { type: 'boolean' },
  });
  const { project, apply } = guardTarget({ project: args.project, apply: args.apply });

  initializeApp({ projectId: project });
  const db = getFirestore();
  const auth = getAuth();

  // 1. Spot counts per owner, all statuses (D8).
  const countByUid = new Map<string, number>();
  const spots = await db.collection('spots').select('createdBy').get();
  for (const spot of spots.docs) {
    const owner: unknown = spot.get('createdBy');
    if (typeof owner === 'string' && owner.length > 0) {
      countByUid.set(owner, (countByUid.get(owner) ?? 0) + 1);
    }
  }

  // 2. Admins: ids for isAdmin, plus a read-only integrity check (doc id must be an Auth uid
  //    whose email matches the doc's email, case-insensitively).
  const admins = await db.collection('admins').get();
  const adminIds = new Set(admins.docs.map((d) => d.id));
  const invalidAdmins: string[] = [];
  for (const admin of admins.docs) {
    const docEmail: unknown = admin.get('email');
    let valid = false;
    try {
      const record = await auth.getUser(admin.id);
      valid = typeof docEmail === 'string' && typeof record.email === 'string' &&
        record.email.toLowerCase() === docEmail.toLowerCase();
    } catch (error) {
      if ((error as { code?: unknown }).code !== 'auth/user-not-found') throw error;
    }
    if (!valid) invalidAdmins.push(admin.id);
  }

  // 3. Username registry as it stands.
  const registry = new Map<string, unknown>();
  for (const reg of (await db.collection('usernames').get()).docs) {
    registry.set(reg.id, reg.get('uid'));
  }

  // 4. Users, paged by document id.
  const writes: Write[] = [];
  let userCount = 0;
  let profilesToWrite = 0;
  let countsToFix = 0;
  const uidsByName = new Map<string, string[]>();
  const invalidUsernames: string[] = [];

  let last: QueryDocumentSnapshot | undefined;
  for (;;) {
    let query = db.collection('users').orderBy(FieldPath.documentId()).limit(PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const page = await query.get();
    if (page.empty) break;
    last = page.docs[page.docs.length - 1];

    const profileRefs = page.docs.map((u) => db.collection('publicProfiles').doc(u.id));
    const profiles = await db.getAll(...profileRefs);

    page.docs.forEach((userSnap, i) => {
      userCount++;
      const uid = userSnap.id;
      const user = userSnap.data();
      const spotsCount = countByUid.get(uid) ?? 0;

      if (user.spotsCount !== spotsCount) {
        countsToFix++;
        writes.push({ kind: 'update', ref: userSnap.ref, data: { spotsCount } });
      }

      const projection = { ...buildPublicProfile({ ...user, spotsCount }, { isAdmin: adminIds.has(uid) }) };
      const stored = profiles[i].data();
      // Merge semantics: current when merging the projection into the stored doc changes nothing.
      if (!stored || !profileFieldsEqual({ ...stored, ...projection }, stored)) {
        profilesToWrite++;
        writes.push({
          kind: 'set-merge',
          ref: profileRefs[i],
          data: { ...projection, updatedAt: FieldValue.serverTimestamp() },
        });
      }

      const name = normalizeUsername(user.username);
      if (!name) {
        invalidUsernames.push(uid);
      } else {
        uidsByName.set(name, [...(uidsByName.get(name) ?? []), uid]);
      }
    });
  }

  // 5. Username registry plan: register unique names only; never touch users.username.
  let usernamesToRegister = 0;
  const duplicates: { name: string; uids: string[] }[] = [];
  const conflicts: { name: string; registeredUid: string; uid: string }[] = [];
  for (const [name, uids] of [...uidsByName].sort(([a], [b]) => a.localeCompare(b))) {
    if (uids.length > 1) {
      duplicates.push({ name, uids });
      continue;
    }
    const uid = uids[0];
    if (!registry.has(name)) {
      usernamesToRegister++;
      writes.push({ kind: 'create', ref: db.collection('usernames').doc(name), data: { uid } });
    } else if (registry.get(name) !== uid) {
      conflicts.push({ name, registeredUid: String(registry.get(name)), uid });
    }
  }

  // 6. Report (no emails).
  console.log(`users: ${userCount}`);
  console.log(`profiles to write: ${profilesToWrite}`);
  console.log(`counts to fix: ${countsToFix}`);
  console.log(`usernames to register: ${usernamesToRegister}`);
  console.log(`planned writes: ${writes.length}`);
  console.log(`duplicates: ${duplicates.length}`);
  console.log(`conflicts: ${conflicts.length}`);
  console.log(`invalid: ${invalidUsernames.length}`);
  console.log(`admins invalid: ${invalidAdmins.length}`);
  for (const d of duplicates) console.log(`duplicate username: ${d.name} uids=${d.uids.join(',')}`);
  for (const c of conflicts) {
    console.log(`conflict username: ${c.name} registered=${c.registeredUid} user=${c.uid}`);
  }
  for (const uid of invalidUsernames) console.log(`invalid username: uid=${uid}`);
  for (const id of invalidAdmins) console.log(`invalid admin doc: ${id}`);

  if (!apply) {
    console.log('dry-run: nothing written (pass --apply to write)');
    return;
  }

  // 7. Apply in batches of at most BATCH_LIMIT writes.
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + BATCH_LIMIT)) {
      if (w.kind === 'update') batch.update(w.ref, w.data);
      else if (w.kind === 'set-merge') batch.set(w.ref, w.data, { merge: true });
      else batch.create(w.ref, w.data);
    }
    await batch.commit();
  }
  console.log(`applied: ${writes.length} writes`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
