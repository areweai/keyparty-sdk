// ESLint configuration for kp-node-sdk package
// Node.js-only SDK (no React dependencies)

import js from '@eslint/js';
import globals from 'globals';
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
    },
    rules: {
      // TypeScript Rules
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn', // Allow any for now in SDK responses
      '@typescript-eslint/prefer-nullish-coalescing': 'off', // Disabled - we intentionally use || for default values
      '@typescript-eslint/prefer-optional-chain': 'error',

      // General Code Quality
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
      'no-console': 'off',
    },
  },
  {
    // Test files configuration
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests for mocking
    },
  },
];
