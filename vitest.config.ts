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
  },
});
