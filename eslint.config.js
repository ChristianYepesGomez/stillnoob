import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-constant-condition': 'warn',
      'prefer-const': 'error',
    },
  },
  {
    ignores: ['node_modules/', 'dist/', '.wrangler/', 'packages/web/dist/', 'workers/'],
  },
];
