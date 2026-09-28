import { defineConfig } from 'vitest/config';

// Firestore/Storage rules tests (T12). Run through `npm run test:rules`, which starts the
// emulators; files run serially because they share one emulator project.
export default defineConfig({
  test: {
    include: ['tests/rules/**/*.test.ts'],
    environment: 'node',
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
