// Shared argument parsing and safety guard for admin scripts (T08; reused by T09, T13).
// Credentials come only from Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS
// or `gcloud auth application-default login`); key paths are never read from argv.
import { parseArgs as nodeParseArgs } from 'node:util';

export type ArgSpec = Record<string, { type: 'string' | 'boolean' }>;
export type ParsedArgs<S extends ArgSpec> = {
  [K in keyof S]?: S[K]['type'] extends 'boolean' ? boolean : string;
};

export interface Target {
  project: string;
  apply: boolean;
  emulator: boolean;
}

function fail(message: string): never {
  console.error(message);
  process.exit(2);
}

/** Strictly parses `--name value` / `--flag` options; unknown or malformed args exit 2. */
export function parseArgs<S extends ArgSpec>(argv: string[], spec: S): ParsedArgs<S> {
  try {
    const { values, positionals } = nodeParseArgs({
      args: argv,
      options: spec,
      strict: true,
      allowPositionals: false,
    });
    if (positionals.length > 0) fail(`unexpected arguments: ${positionals.join(' ')}`);
    return values as ParsedArgs<S>;
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Refuses unsafe targets (exit 2) and prints the banner. Dry-run unless `apply` is true.
 * - `--project` is required.
 * - `demo-*` projects run only against the emulators (FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST set).
 * - A real project id is never mixed with emulator env.
 */
export function guardTarget({ project, apply }: { project?: string; apply?: boolean }): Target {
  if (!project) fail('--project is required');
  const firestoreEmu = process.env.FIRESTORE_EMULATOR_HOST;
  const authEmu = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const isDemo = project.startsWith('demo-');
  if (isDemo && (!firestoreEmu || !authEmu)) {
    fail(`refusing: ${project} is a demo project but FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST must both be set`);
  }
  if (!isDemo && (firestoreEmu || authEmu)) {
    fail(`refusing: real project ${project} must not be combined with emulator env`);
  }
  const target: Target = { project, apply: apply === true, emulator: Boolean(firestoreEmu) };
  console.log(
    `TARGET=${target.project} MODE=${target.apply ? 'APPLY' : 'dry-run'} EMULATOR=${target.emulator ? 'yes' : 'no'}`,
  );
  return target;
}
