import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'
import globals from 'globals'
import i18next from 'eslint-plugin-i18next'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'coverage', 'supabase/.temp', 'src/lib/database.types.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      tseslint.configs.stylisticTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Nessun testo dell'interfaccia scritto nei componenti: tutto passa dall'i18n (src/i18n).
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx', 'src/components/ui/**'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'error',
        {
          mode: 'jsx-only',
          'jsx-attributes': {
            exclude: [
              '^(className|style|type|key|id|width|height|to|href|rel|target|role|src|loading|decoding|tabIndex|end|lang)$',
              '^aria-(hidden|current|pressed|checked|modal)$',
            ],
          },
        },
      ],
    },
  },
  {
    // I componenti shadcn/ui esportano anche le varianti (es. buttonVariants).
    files: ['src/components/ui/**/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    files: ['tests/**/*.ts', 'catalog-sync/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ['**/*.js'],
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Script serviti così come sono al browser (es. theme-init.js).
    files: ['public/**/*.js'],
    languageOptions: { globals: globals.browser, sourceType: 'script' },
  },
  prettier,
])
