import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { runtimeCaching } from './pwa/runtime-caching.ts'

// Source map per Sentry (RIB-35): solo con il token di Sentry (build di Netlify). Si generano
// "hidden" (senza riferimento nei file .js), si caricano su Sentry e poi si cancellano da dist:
// non vengono mai pubblicate sul sito.
const sentryUpload = Boolean(process.env.SENTRY_AUTH_TOKEN)

// https://vite.dev/config/
export default defineConfig({
  build: { sourcemap: sentryUpload ? 'hidden' : false },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // Una nuova versione non si attiva da sola: l'app mostra "Nuova versione disponibile".
      registerType: 'prompt',
      // La registrazione la fa l'app (src/app/UpdatePrompt.tsx): niente script inline, la CSP resta 'self'.
      injectRegister: false,
      // logo.png: il logo nell'intestazione, visibile anche offline.
      includeAssets: ['favicon.png', 'logo.png', 'icons/apple-touch-icon.png', 'theme-init.js'],
      workbox: {
        // App e font (solo latino) sempre disponibili offline; icone e favicon arrivano da
        // includeAssets e dal manifest; le immagini delle carte da runtimeCaching.
        globPatterns: ['**/*.{js,css,html}', 'assets/geist-latin*.woff2'],
        runtimeCaching,
      },
      manifest: {
        id: '/',
        name: 'OP-Codex',
        short_name: 'OP-Codex',
        description: 'Catalogo, collezione e deck builder per il One Piece Card Game',
        lang: 'it',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        categories: ['games', 'entertainment'],
        // Colori della schermata di avvio (Android) e della barra di sistema.
        background_color: '#0b0f19',
        theme_color: '#0b0f19',
        // Icone generate da brand/logo.png (npm run icons, scripts/generate-icons.mjs).
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
    // Per ultimo: carica le source map dopo che tutto è stato scritto. SENTRY_ORG, SENTRY_PROJECT
    // e SENTRY_AUTH_TOKEN stanno nelle variabili di Netlify (il token è un segreto).
    sentryVitePlugin({
      disable: !sentryUpload,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      telemetry: false,
      sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['src/**/*.test.{ts,tsx}'],
          setupFiles: ['src/test/setup.ts'],
        },
      },
      {
        // Codice che gira in Node (Catalog Sync, configurazione della PWA): niente browser né database.
        test: {
          name: 'sync',
          environment: 'node',
          include: ['catalog-sync/**/*.test.ts', 'pwa/**/*.test.ts'],
        },
      },
      {
        // Test sul Supabase locale: richiedono `npx supabase start` (o `npx supabase db start`).
        test: {
          name: 'db',
          environment: 'node',
          include: ['tests/db/**/*.test.ts'],
        },
      },
    ],
  },
})
