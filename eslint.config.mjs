import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypescript,
  globalIgnores([
    '.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'functions/**',
    'coverage/**', 'playwright-report/**', 'test-results/**',
    'postcss.config.cjs', // CommonJS config; not covered by the Next/react-hooks plugin globs
  ]),
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx,mts,cts}'],
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      // Pre-existing violations at T01 (baseline 51 / 10 / 1). Warn only; fix while touching code.
      '@typescript-eslint/no-explicit-any': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]);
