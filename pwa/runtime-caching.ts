import type { VitePWAOptions } from 'vite-plugin-pwa'
import { IMAGE_CACHE_LIMITS, IMAGE_CACHES } from '../src/catalog/image-caches.ts'

// Cache del service worker per le immagini delle carte (RIB-16, ADR-0005): una volta viste
// (o scaricate per Set o tutte dalle Impostazioni) restano disponibili offline.

type RuntimeCaching = NonNullable<NonNullable<VitePWAOptions['workbox']>['runtimeCaching']>[number]

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
