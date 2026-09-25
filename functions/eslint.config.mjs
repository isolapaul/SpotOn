// ESLint 9 flat config for Cloud Functions (replaces .eslintrc.js / eslint-config-google).
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['lib/**', 'generated/**']),
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts', '**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    plugins: { '@stylistic': stylistic },
    rules: {
      // Google-like style kept from the old config.
      '@stylistic/quotes': ['error', 'double', { avoidEscape: true }],
      '@stylistic/indent': ['error', 2],
      '@stylistic/max-len': ['error', { code: 100, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
      '@stylistic/object-curly-spacing': ['error', 'never'],
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/eol-last': ['error', 'always'],
      // Pre-existing violations at T07 (11 / 21 / 5). Warn only; fix when touching the code (T08+).
      '@typescript-eslint/no-explicit-any': 'warn',
      '@stylistic/comma-dangle': ['warn', 'always-multiline'],
      '@stylistic/no-trailing-spaces': 'warn',
    },
  },
]);
