import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const node = { process: 'readonly', console: 'readonly', URL: 'readonly', fetch: 'readonly', Buffer: 'readonly', setTimeout: 'readonly' };
const browser = { document: 'readonly', window: 'readonly', navigator: 'readonly', localStorage: 'readonly', getComputedStyle: 'readonly' };

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['scripts/**/*.mjs'], languageOptions: { globals: { ...node, ...browser } } },
);
