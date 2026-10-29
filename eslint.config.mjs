// ESLint: ловим неопределённые и неиспользуемые имена (пропущенные импорты при разбиении на модули).
import globals from 'globals';

export default [
  { ignores: ['vendor/**', 'dist/**', 'examples/**', 'node_modules/**'] },
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser }
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }]
    }
  },
  {
    files: ['tests/**', 'scripts/**', 'eslint.config.mjs'],
    languageOptions: { globals: { ...globals.node } }
  }
];
