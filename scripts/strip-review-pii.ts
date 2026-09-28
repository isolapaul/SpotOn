// Removes leaked reviewer PII and spoofable metadata from spots/{id}.reviews[] (T13; SEC-03, SEC-05).
// Usage: npx tsx scripts/strip-review-pii.ts --project <id> [--apply | --check]
// Dry-run by default; --apply writes; --check is read-only and exits 1 while any review still holds a
// PII key (the post-condition check). See scripts/lib/cli.ts for the target guard.
// Only `reviews` is rewritten, in place (same length, same order), so no notification or recount
// trigger fires. Each write is guarded by the doc's lastUpdateTime, so a review appended concurrently
// is never lost. Output is counts only: never emails, names or review content.
import { initializeApp } from 'firebase-admin/app';
import {
  FieldPath,
  getFirestore,
  type DocumentReference,
  type DocumentSnapshot,
  type Firestore,
  type QueryDocumentSnapshot,
  type Timestamp,
} from 'firebase-admin/firestore';
import { guardTarget, parseArgs } from './lib/cli';
import { stripReviews } from './lib/stripReviewPii';

const PAGE_SIZE = 200;
const BATCH_LIMIT = 400;
const MAX_RETRIES = 3;
const FAILED_PRECONDITION = 9;

interface PlannedWrite {
  ref: DocumentReference;
  reviews: unknown[];
  lastUpdateTime: Timestamp;
}

interface Counters {
  scanned: number;
  toUpdate: number;
  reviewsStripped: number;
  committed: number;
  retries: number;
}

function plan(snap: DocumentSnapshot): (PlannedWrite & { strippedCount: number }) | null {
  if (!snap.exists || !snap.updateTime) return null;
  const result = stripReviews(snap.get('reviews'));
  if (!result.changed) return null;
  return { ref: snap.ref, reviews: result.reviews, lastUpdateTime: snap.updateTime, strippedCount: result.strippedCount };
}

function isFailedPrecondition(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === FAILED_PRECONDITION;
}

/** Commits one batch; on a precondition failure re-reads the batch's docs and retries (at most MAX_RETRIES). */
async function commitWithRetry(db: Firestore, writes: PlannedWrite[], counters: Counters): Promise<void> {
  let pending = writes;
  for (let attempt = 0; ; attempt++) {
    if (pending.length === 0) return;
    const batch = db.batch();
    for (const w of pending) batch.update(w.ref, { reviews: w.reviews }, { lastUpdateTime: w.lastUpdateTime });
    try {
      await batch.commit();
      counters.committed += pending.length;
      return;
    } catch (error) {
      if (!isFailedPrecondition(error)) throw error;
      if (attempt >= MAX_RETRIES) {
        throw new Error(`batch of ${pending.length} writes still failing its precondition after ${MAX_RETRIES} retries`);
      }
      counters.retries++;
      const fresh = await db.getAll(...pending.map((w) => w.ref));
      pending = fresh.map(plan).filter((w): w is PlannedWrite & { strippedCount: number } => w !== null);
      // One busy spot must not stall the whole batch: after a conflict, commit each doc on its own,
      // keep going past docs that still fail, and report how many did (a re-run picks them up).
      if (pending.length > 1) {
        let failed = 0;
        for (const w of pending) {
          try {
            await commitWithRetry(db, [w], counters);
          } catch (e) {
            if (!(e instanceof Error && e.message.includes('precondition'))) throw e;
            failed++;
          }
        }
        if (failed > 0) throw new Error(`${failed} busy spot(s) still failing their precondition; re-run --apply`);
        return;
      }
    }
  }
}

function report(counters: Counters): void {
  console.log(`spots scanned: ${counters.scanned}`);
  console.log(`spots to update: ${counters.toUpdate}`);
  console.log(`reviews stripped: ${counters.reviewsStripped}`);
  console.log(`writes committed: ${counters.committed}`);
  console.log(`retries: ${counters.retries}`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), {
    project: { type: 'string' },
    apply: { type: 'boolean' },
    check: { type: 'boolean' },
  });
  if (args.apply && args.check) {
    console.error('--apply and --check are mutually exclusive');
    process.exit(2);
  }
  const { project, apply } = guardTarget({ project: args.project, apply: args.apply });
  const check = args.check === true;

  initializeApp({ projectId: project });
  const db = getFirestore();
  const counters: Counters = { scanned: 0, toUpdate: 0, reviewsStripped: 0, committed: 0, retries: 0 };

  // Page through spots by document id; with --apply, commit each page's writes (<= PAGE_SIZE <= BATCH_LIMIT)
  // right away so every lastUpdateTime precondition is as fresh as possible.
  let last: QueryDocumentSnapshot | undefined;
  for (;;) {
    let query = db.collection('spots').orderBy(FieldPath.documentId()).select('reviews').limit(PAGE_SIZE);
    if (last) query = query.startAfter(last);
    const page = await query.get();
    if (page.empty) break;
    last = page.docs[page.docs.length - 1];

    const writes: PlannedWrite[] = [];
    for (const snap of page.docs) {
      counters.scanned++;
      const w = plan(snap);
      if (!w) continue;
      counters.toUpdate++;
      counters.reviewsStripped += w.strippedCount;
      writes.push({ ref: w.ref, reviews: w.reviews, lastUpdateTime: w.lastUpdateTime });
    }

    if (apply) {
      for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
        try {
          await commitWithRetry(db, writes.slice(i, i + BATCH_LIMIT), counters);
        } catch (error) {
          report(counters); // what was committed so far; a re-run picks up the rest (idempotent)
          throw error;
        }
      }
    }
  }

  report(counters);

  if (check) {
    if (counters.toUpdate > 0) {
      console.log('check: FAILED (reviews still hold PII keys)');
      process.exit(1);
    }
    console.log('check: OK (no review holds a PII key)');
    return;
  }
  if (!apply) console.log('dry-run: nothing written (pass --apply to write)');
}

main().catch((error: unknown) => {
  // Counts-only policy: print the error's message and code, never a payload.
  const code = typeof error === 'object' && error !== null ? (error as { code?: unknown }).code : undefined;
  console.error(`failed${code !== undefined ? ` (code ${String(code)})` : ''}: ${error instanceof Error ? error.message : 'unknown error'}`);
  process.exit(3); // distinct from --check's exit 1 ("PII remains")
});
