// Validates the build-time NEXT_PUBLIC_* config (T16). Prints variable names only, never values.
// Usage: node scripts/check-public-env.mjs [--production]
// Not a prebuild hook: local and CI emulator builds use demo values; the Dockerfile calls it explicitly.

const REQUIRED = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_VAPID_KEY',
];

const production = process.argv.slice(2).includes('--production');
const env = process.env;
const missing = [];
const invalid = [];
const forbidden = [];

for (const name of REQUIRED) {
  const value = env[name];
  if (value === undefined || value === '') {
    missing.push(name);
  } else if (value.trim() !== value || /["'`]/.test(value)) {
    invalid.push(name);
  }
}

const authDomain = env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
if (authDomain && !invalid.includes('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN') && !/^[a-z0-9.-]+(:[0-9]+)?$/.test(authDomain)) {
  invalid.push('NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN');
}

if (production) {
  if (env.NEXT_PUBLIC_USE_EMULATORS === '1') forbidden.push('NEXT_PUBLIC_USE_EMULATORS');
  for (const name of ['NEXT_PUBLIC_MOVED_TO', 'NEXT_PUBLIC_ADMIN_EMAIL']) {
    if (env[name] !== undefined) forbidden.push(name);
  }
}

if (missing.length || invalid.length || forbidden.length) {
  if (missing.length) console.error(`missing public env: ${missing.join(', ')}`);
  if (invalid.length) console.error(`invalid public env (whitespace, quotes or bad format): ${invalid.join(', ')}`);
  if (forbidden.length) console.error(`forbidden in production builds: ${forbidden.join(', ')}`);
  process.exit(1);
}

console.log(`public env OK (${REQUIRED.length} vars)`);
