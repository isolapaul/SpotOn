import { defineConfig } from '@playwright/test';
import base from './playwright.config';

// Store graphics and screenshots (scripts/store/capture.spec.ts): the e2e emulator build and browser,
// another test folder. Run with `npm run store:assets`, never in CI.
export default defineConfig({
  ...base,
  testDir: './scripts/store',
  testMatch: 'capture.spec.ts',
  retries: 0,
  timeout: 180_000,
});
