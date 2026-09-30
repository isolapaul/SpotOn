// One-time XP migration (item 5): stores every user's XP, level and level floor, and every spot's
// contributors, computed from all spots. Run once after the functions deploy (syncXp keeps them
// current afterwards); running it again only fixes differences.
// Usage: npx tsx scripts/migrate-xp.ts --project <id> [--apply]
// Dry-run by default; see scripts/lib/cli.ts for the target guard.
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { guardTarget, parseArgs } from './lib/cli';
import { applyXp, planXp } from './lib/xpPlan';

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2), { project: { type: 'string' }, apply: { type: 'boolean' } });
  const { project, apply } = guardTarget({ project: args.project, apply: args.apply });

  initializeApp({ projectId: project });
  const db = getFirestore();
  const plan = await planXp(db);

  console.log(`PLAN: ${plan.spots.length} of ${plan.spotCount} spots get contributors, ` +
    `${plan.users.length} of ${plan.userCount} users get XP fields`);
  for (const { uid, before, after } of plan.users) {
    console.log(`  users/${uid}: xp ${before.xp ?? '-'} -> ${after.xp}, level ${before.level ?? '-'} -> ${after.level}, ` +
      `floor ${before.levelFloor ?? '-'} -> ${after.levelFloor}`);
  }

  if (!apply) {
    console.log('dry-run: nothing written (pass --apply to write)');
    return;
  }
  await applyXp(db, plan);
  console.log('applied');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
