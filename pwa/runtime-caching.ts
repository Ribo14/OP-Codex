import type { VitePWAOptions } from 'vite-plugin-pwa'

// Cache del service worker per le immagini delle carte (RIB-16, ADR-0005): una volta viste
// (o scaricate con "Scarica le immagini di questo Set") restano disponibili offline.

type RuntimeCaching = NonNullable<NonNullable<VitePWAOptions['workbox']>['runtimeCaching']>[number]

export const IMAGE_CACHES = {
  thumb: 'card-images-thumb',
  full: 'card-images-full',
} as const

/** Limiti delle cache: oltre, si scartano le immagini usate meno di recente. */
export const IMAGE_CACHE_LIMITS = {
  // Tutte le miniature del catalogo (~4.900 × 25 KB ≈ 120 MB) con margine per i nuovi Set.
  thumb: 6000,
  // Immagini grandi (~80 KB): qualche Set scaricato per intero più le carte aperte.
  full: 1500,
} as const

const MAX_AGE_SECONDS = 180 * 24 * 60 * 60

/**
 * URL di un'immagine su Supabase Storage (http solo col Supabase locale). Per le richieste
 * verso un altro dominio Workbox accetta solo espressioni che partono dall'inizio dell'URL.
 */
export function imageUrlPattern(variant: keyof typeof IMAGE_CACHES): RegExp {
  return new RegExp(
    `^https?://[^/]+/storage/v1/object/public/card-images/${variant}/[A-Za-z0-9_-]+\\.webp$`,
  )
}

function imageCache(variant: keyof typeof IMAGE_CACHES): RuntimeCaching {
  return {
    urlPattern: imageUrlPattern(variant),
    // Un'immagine di una Printing non cambia: se è in cache non serve chiederla al server.
    handler: 'CacheFirst',
    options: {
      cacheName: IMAGE_CACHES[variant],
      // Solo risposte CORS riuscite (le <img> usano crossOrigin="anonymous"): niente risposte
      // opache, che il browser conterebbe molto più grandi del vero.
      cacheableResponse: { statuses: [200] },
      expiration: {
        maxEntries: IMAGE_CACHE_LIMITS[variant],
        maxAgeSeconds: MAX_AGE_SECONDS,
        purgeOnQuotaError: true,
      },
    },
  }
}

export const runtimeCaching: RuntimeCaching[] = [imageCache('thumb'), imageCache('full')]
