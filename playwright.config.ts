import { defineConfig, devices } from '@playwright/test';

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;

// Non-secret demo config; the emulators accept any API key for a demo-* project.
// Playwright merges this over process.env, so extra vars (e.g. NEXT_PUBLIC_MOVED_TO for T19) pass through.
const E2E_ENV = {
  NEXT_PUBLIC_USE_EMULATORS: '1',
  NEXT_DIST_DIR: '.next-e2e',
  NEXT_PUBLIC_FIREBASE_API_KEY: 'demo-api-key',
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo-spoton.firebaseapp.com',
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-spoton',
  NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-spoton.appspot.com',
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '000000000000',
  NEXT_PUBLIC_FIREBASE_APP_ID: '1:000000000000:web:0000000000000000000000',
  NEXT_PUBLIC_FIREBASE_VAPID_KEY: '',
  NEXT_PUBLIC_ADMIN_EMAIL: '',
};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  forbidOnly: !!process.env.CI,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    locale: 'en-US',
    geolocation: { latitude: 47.4979, longitude: 19.0402 },
    permissions: ['geolocation'],
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Fallback if the installed browser build does not match this Playwright version.
        launchOptions: process.env.PW_CHROMIUM_EXECUTABLE
          ? { executablePath: process.env.PW_CHROMIUM_EXECUTABLE }
          : {},
      },
    },
  ],
  webServer: {
    command: `npx next build && npx next start -H 127.0.0.1 -p ${PORT}`,
    url: BASE_URL,
    env: E2E_ENV,
    timeout: 300_000,
    reuseExistingServer: false,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
