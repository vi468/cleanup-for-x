// ---------------------------------------------------------------------------
//  Линтер: ищем только то, что реально ломает код — необъявленные имена,
//  повторное объявление и потерянные переменные. Стиль не трогаем.
// ---------------------------------------------------------------------------
const БРАУЗЕР = {
  window: 'readonly',
  document: 'readonly',
  location: 'readonly',
  navigator: 'readonly',
  chrome: 'readonly',
  crypto: 'readonly',
  performance: 'readonly',
  fetch: 'readonly',
  console: 'readonly',
  setTimeout: 'readonly',
  setInterval: 'readonly',
  clearTimeout: 'readonly',
  clearInterval: 'readonly',
  URL: 'readonly',
  Blob: 'readonly',
  File: 'readonly',
  Event: 'readonly',
  MouseEvent: 'readonly',
  Element: 'readonly',
  Node: 'readonly',
  KeyboardEvent: 'readonly',
  MutationObserver: 'readonly',
  getComputedStyle: 'readonly',
  confirm: 'readonly',
  // наши общие модули, они живут в window
  XC: 'readonly',
  XHistory: 'readonly',
  XProtect: 'readonly',
  XQLookup: 'readonly',
  XCDock: 'readonly',
  XJobPanel: 'readonly',
  XStore: 'readonly',
  XCModules: 'readonly',
  XCI18n: 'readonly',
  __XCleaner: 'readonly'
};

const ПРАВИЛА = {
  'no-undef': 'error',
  'no-redeclare': 'error',
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
  'no-constant-condition': ['error', { checkLoops: false }]
};

export default [
  {
    ignores: ['node_modules/**', '.tmp/**', 'design/**']
  },
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: БРАУЗЕР
    },
    rules: ПРАВИЛА
  },
  {
    // service worker и тесты — ES-модули
    files: ['background/**/*.js', 'test/**/*.js', 'eslint.config.js'],
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...БРАУЗЕР,
        process: 'readonly'
      }
    }
  },
  {
    files: ['test/**/*.js'],
    languageOptions: {
      globals: {
        ...БРАУЗЕР,
        process: 'readonly'
      }
    }
  }
];
