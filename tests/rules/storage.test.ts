// Storage rules (T12, SEC-11): owner-only image creates under 5 MB, public reads, no overwrite/delete.
import { assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { deleteObject, getMetadata, ref, uploadBytes, type FirebaseStorage } from 'firebase/storage';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import { ALICE, BOB, setupEnv } from './helpers';

const MB5 = 5 * 1024 * 1024;
const LEGACY = 'spot-images/123_a.jpg';
const EXISTING = `spot-images/${ALICE}/existing.jpg`;
let env: RulesTestEnvironment;

function storageAs(uid: string | null): FirebaseStorage {
  const ctx = uid === null ? env.unauthenticatedContext() : env.authenticatedContext(uid);
  return ctx.storage() as unknown as FirebaseStorage;
}
const bytes = (n: number) => new Uint8Array(n);
const put = (st: FirebaseStorage, path: string, contentType = 'image/jpeg', size = 1024) =>
  uploadBytes(ref(st, path), bytes(size), { contentType });

beforeAll(async () => { env = await setupEnv(); });
beforeEach(async () => {
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const st = ctx.storage() as unknown as FirebaseStorage;
    await put(st, LEGACY);
    await put(st, EXISTING);
  });
});
afterAll(async () => { await env.cleanup(); });

describe('storage: allowed', () => {
  it('owner uploads JPEG, PNG and WebP under 5 MB to the three user-scoped paths', async () => {
    const st = storageAs(ALICE);
    await assertSucceeds(put(st, `spot-images/${ALICE}/x.jpg`, 'image/jpeg', MB5 - 1));
    await assertSucceeds(put(st, `spot-images/${ALICE}/y.png`, 'image/png'));
    await assertSucceeds(put(st, `spot-images/${ALICE}/z.webp`, 'image/webp'));
    await assertSucceeds(put(st, `profile-pictures/${ALICE}/1_x.jpg`, 'image/jpeg'));
    await assertSucceeds(put(st, `profile-pictures/${ALICE}/2_x.png`, 'image/png'));
    await assertSucceeds(put(st, `profile-banners/${ALICE}/1_x.jpg`, 'image/jpeg'));
    await assertSucceeds(put(st, `profile-banners/${ALICE}/2_x.webp`, 'image/webp'));
  });
  it('anyone reads the legacy flat path and new paths', async () => {
    const anon = storageAs(null);
    await assertSucceeds(getMetadata(ref(anon, LEGACY)));
    await assertSucceeds(getMetadata(ref(anon, EXISTING)));
  });
});

describe('storage: SEC-11 denials', () => {
  it('denies uploads to another uid folder and unauthenticated uploads', async () => {
    await assertFails(put(storageAs(BOB), `spot-images/${ALICE}/x.jpg`));
    await assertFails(put(storageAs(BOB), `profile-pictures/${ALICE}/1_x.jpg`));
    await assertFails(put(storageAs(BOB), `profile-banners/${ALICE}/1_x.jpg`));
    await assertFails(put(storageAs(null), `spot-images/${ALICE}/x.jpg`));
  });
  it('denies exactly 5 MB and non-image or unsupported types', async () => {
    const st = storageAs(ALICE);
    await assertFails(put(st, `spot-images/${ALICE}/big.jpg`, 'image/jpeg', MB5));
    await assertFails(put(st, `profile-pictures/${ALICE}/big.jpg`, 'image/jpeg', MB5));
    for (const type of ['image/gif', 'text/html', 'application/octet-stream', 'image/svg+xml', 'image/jpegx']) {
      await assertFails(put(st, `spot-images/${ALICE}/f`, type));
    }
  });
  it('denies writes to the legacy flat path, overwrites and deletes', async () => {
    const st = storageAs(ALICE);
    await assertFails(put(st, 'spot-images/999_new.jpg'));
    await assertFails(put(st, LEGACY));
    await assertFails(put(st, EXISTING));
    await assertFails(deleteObject(ref(st, EXISTING)));
    await assertFails(deleteObject(ref(st, LEGACY)));
  });
  it('denies unknown paths (incl. the unused live `spots/` path and nested folders)', async () => {
    const st = storageAs(ALICE);
    await assertFails(put(st, `other/${ALICE}/x.jpg`));
    await assertFails(put(st, `spots/${ALICE}/x.jpg`));
    await assertFails(put(st, `profile-pictures/${ALICE}/a/b.jpg`));
    await assertFails(getMetadata(ref(storageAs(null), 'other/x.jpg')));
  });
});
