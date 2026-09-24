// Nomi e limiti delle cache delle immagini nel service worker (ADR-0005). Condivisi tra la
// configurazione del service worker (pwa/runtime-caching.ts) e l'app, che le legge e le svuota.

export const IMAGE_CACHES = {
  thumb: 'card-images-thumb',
  full: 'card-images-full',
} as const

/** Limiti delle cache: oltre, si scartano le immagini usate meno di recente. */
export const IMAGE_CACHE_LIMITS = {
  // Tutto il catalogo (~4.900 Printing) con margine per i nuovi Set: "Scarica tutte le
  // immagini" (Impostazioni) non deve cancellare da sé le prime immagini scaricate.
  thumb: 6000,
  full: 6000,
} as const

/** Peso medio di un'immagine (misurato su Supabase Storage), per stimare lo spazio. */
export const IMAGE_AVERAGE_BYTES = {
  thumb: 28_000,
  full: 85_000,
} as const
