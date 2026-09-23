import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registrazione del service worker da file esterno: niente script inline, così la CSP resta 'self'.
      injectRegister: 'script-defer',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'OP-Codex',
        short_name: 'OP-Codex',
        description: 'Catalogo, collezione e deck builder per il One Piece Card Game',
        lang: 'it',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#0b0f19',
        theme_color: '#0b0f19',
        // Icona segnaposto: il logo definitivo arriverà più avanti.
        icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
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
