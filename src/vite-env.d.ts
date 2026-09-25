/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Chiave pubblica del widget Cloudflare Turnstile (RIB-14). */
  readonly VITE_TURNSTILE_SITE_KEY?: string
  /** DSN di Sentry per la segnalazione degli errori (RIB-35); senza, niente Sentry. */
  readonly VITE_SENTRY_DSN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
