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
    ignores: ['**/*.test.ts', '**/__tests__/**'],
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
    // Test files configuration - disable project references to avoid tsconfig conflicts
    files: ['**/*.test.ts', '**/__tests__/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        // No project reference for test files since they're excluded from tsconfig.json
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests for mocking
    },
  },
];
