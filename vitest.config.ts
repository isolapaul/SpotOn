import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**', 'functions/**', 'tests/rules/**', '.next/**', '.next-e2e/**'],
    // `vitest run --coverage` (T23): the pure lib/ modules must stay ≥ 90 % covered.
    coverage: {
      provider: 'v8',
      include: ['src/lib/**'],
      exclude: [
        // Side-effectful Firebase client init (network, emulator wiring): covered by e2e, not unit tests.
        'src/lib/firebase.ts',
        // Pure data (hu/en/de dictionaries): no logic; key parity is checked by translations.test.ts.
        'src/lib/translations.ts',
        // Pre-T23 implementations kept only as test oracles.
        'src/lib/__oracles__/**',
        '**/*.test.ts', // test files themselves are not measured
      ],
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
