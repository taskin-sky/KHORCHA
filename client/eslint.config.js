import js from '@eslint/js'; import globals from 'globals'; import hooks from 'eslint-plugin-react-hooks'; import refresh from 'eslint-plugin-react-refresh';
export default [
  { ignores: ['dist'] },
  js.configs.recommended,
  { files: ['**/*.{js,jsx}'], plugins: { 'react-hooks': hooks, 'react-refresh': refresh }, languageOptions: { ecmaVersion: 2023, globals: globals.browser, parserOptions: { ecmaVersion: 'latest', ecmaFeatures: { jsx: true }, sourceType: 'module' } }, rules: { ...hooks.configs.recommended.rules, 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }], 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^[A-Z_]' }] } }
];
