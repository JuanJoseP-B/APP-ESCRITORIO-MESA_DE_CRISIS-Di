import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/coverage/**', '**/target/**', 'archive/**'] },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
