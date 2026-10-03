// Computes everyone's XP and level from all spots at once (item 5), with the same pure rules the
// syncXp trigger uses (functions/src/lib/xp.ts). Shared by scripts/migrate-xp.ts and the emulator
// seed. Only differences are planned; applying writes them in batches. The level floor (the old
// spot-count level) is set here only: run it once, right after the functions deploy.
import { FieldValue, type Firestore, type WriteBatch } from 'firebase-admin/firestore';
import { sameContributors, spotContributors, spotXp, userLevelFields } from '../../functions/src/lib/xp';

type Fields = { xp: number; level: number; levelFloor: number };

export interface XpPlan {
  spots: { id: string; contributors: string[] }[];
  users: { uid: string; before: Partial<Fields>; after: Fields; profileOnly: boolean }[];
  /** Users seen: everyone with a users doc. */
  userCount: number;
  spotCount: number;
}

const BATCH = 400;

export async function planXp(db: Firestore): Promise<XpPlan> {
  const [spotsSnap, usersSnap, profilesSnap] = await Promise.all([
    db.collection('spots').get(),
    db.collection('users').get(),
    db.collection('publicProfiles').get(),
  ]);

  const xpByUid = new Map<string, number>();
  const ownCount = new Map<string, number>();
  const spots: XpPlan['spots'] = [];
  for (const doc of spotsSnap.docs) {
    const data = doc.data();
    if (typeof data.createdBy === 'string') ownCount.set(data.createdBy, (ownCount.get(data.createdBy) ?? 0) + 1);
    for (const [uid, xp] of spotXp(data)) xpByUid.set(uid, (xpByUid.get(uid) ?? 0) + xp);
    const contributors = spotContributors(data);
    if (!sameContributors(data.contributors, contributors)) spots.push({ id: doc.id, contributors });
  }

  const profiles = new Map(profilesSnap.docs.map((d) => [d.id, d.data()]));
  const users: XpPlan['users'] = [];
  for (const doc of usersSnap.docs) {
    const data = doc.data();
    const after = userLevelFields(xpByUid.get(doc.id) ?? 0, data.levelFloor, ownCount.get(doc.id) ?? 0);
    const userChanged = data.xp !== after.xp || data.level !== after.level || data.levelFloor !== after.levelFloor;
    const profile = profiles.get(doc.id);
    const profileChanged = profile?.xp !== after.xp || profile?.level !== after.level;
    if (!userChanged && !profileChanged) continue;
    const before: Partial<Fields> = { xp: data.xp, level: data.level, levelFloor: data.levelFloor };
    users.push({ uid: doc.id, before, after, profileOnly: !userChanged });
  }
  return { spots, users, userCount: usersSnap.size, spotCount: spotsSnap.size };
}

export async function applyXp(db: Firestore, plan: XpPlan): Promise<void> {
  const writes: ((batch: WriteBatch) => void)[] = [
    ...plan.spots.map(({ id, contributors }) => (b: WriteBatch) => {
      b.update(db.doc(`spots/${id}`), { contributors });
    }),
    ...plan.users.flatMap(({ uid, after, profileOnly }) => [
      ...(profileOnly ? [] : [(b: WriteBatch) => { b.update(db.doc(`users/${uid}`), after); }]),
      (b: WriteBatch) => {
        b.set(db.doc(`publicProfiles/${uid}`),
          { xp: after.xp, level: after.level, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      },
    ]),
  ];
  for (let i = 0; i < writes.length; i += BATCH) {
    const batch = db.batch();
    writes.slice(i, i + BATCH).forEach((write) => write(batch));
    await batch.commit();
  }
}
