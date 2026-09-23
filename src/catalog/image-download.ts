import { cardImageUrl } from './card-image'
import type { CatalogCard } from './catalog-data'

// "Scarica le immagini di questo Set" (RIB-16): basta richiederle, il service worker le
// salva nella sua cache (pwa/runtime-caching.ts) e da lì le serve anche offline.

export interface DownloadProgress {
  done: number
  failed: number
  total: number
}

/** Richieste in parallelo: abbastanza da essere veloci, poche per non intasare la rete. */
const CONCURRENCY = 6

export async function downloadImages(
  urls: readonly string[],
  {
    onProgress,
    signal,
    fetcher = fetch,
  }: {
    onProgress?: (progress: DownloadProgress) => void
    signal?: AbortSignal
    fetcher?: typeof fetch
  } = {},
): Promise<DownloadProgress> {
  const progress: DownloadProgress = { done: 0, failed: 0, total: urls.length }
  let next = 0

  const worker = async () => {
    for (let url = urls[next++]; url !== undefined && !signal?.aborted; url = urls[next++]) {
      try {
        // Come le <img crossOrigin="anonymous">: risposta CORS, che la cache può salvare.
        const response = await fetcher(url, { mode: 'cors', credentials: 'omit', signal })
        if (response.ok) {
          // Il corpo va letto per intero, altrimenti la risposta non finisce in cache.
          await response.blob()
          progress.done++
        } else {
          progress.failed++
        }
      } catch {
        if (signal?.aborted) return
        progress.failed++
      }
      onProgress?.({ ...progress })
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, urls.length) }, worker))
  return progress
}

/** Quante di queste immagini sono già nelle cache del service worker. */
export async function countCached(urls: readonly string[]): Promise<number> {
  if (typeof caches === 'undefined') return 0
  const found = await Promise.all(urls.map((url) => caches.match(url)))
  return found.filter(Boolean).length
}

/** Le immagini (miniatura e grande) di tutte le Printing di un Set. */
export function setImageUrls(cards: readonly CatalogCard[], setCode: string): string[] {
  const urls: string[] = []
  for (const card of cards) {
    for (const p of card.printings) {
      if (p.setCode !== setCode || !p.hasImage) continue
      urls.push(cardImageUrl(p.printId, 'thumb'), cardImageUrl(p.printId, 'full'))
    }
  }
  return urls
}
