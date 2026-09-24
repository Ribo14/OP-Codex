import { cardImageUrl } from './card-image'
import type { CatalogCard } from './catalog-data'
import { IMAGE_AVERAGE_BYTES, IMAGE_CACHES } from './image-caches'

// "Scarica le immagini di questo Set" (RIB-16): basta richiederle, il service worker le
// salva nella sua cache (pwa/runtime-caching.ts) e da lì le serve anche offline.

export interface DownloadProgress {
  done: number
  failed: number
  total: number
}

/** Richieste in parallelo: poche, perché Supabase Storage limita la frequenza (429). */
const CONCURRENCY = 3
/** Tentativi in più per un'immagine rifiutata per troppe richieste (429) o per un errore passeggero del server. */
const RETRIES = 4
const RETRY_BASE_MS = 1000
const RETRY_STATUSES = new Set([429, 502, 503, 504])

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

/** Attesa prima di riprovare: Retry-After se il server lo indica, altrimenti 1, 2, 4, 8 s. */
function retryDelay(response: Response, attempt: number): number {
  const seconds = Number(response.headers.get('Retry-After'))
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds, 30) * 1000
  return RETRY_BASE_MS * 2 ** attempt
}

export async function downloadImages(
  urls: readonly string[],
  {
    onProgress,
    signal,
    fetcher = fetch,
    wait = sleep,
  }: {
    onProgress?: (progress: DownloadProgress) => void
    signal?: AbortSignal
    fetcher?: typeof fetch
    wait?: (ms: number) => Promise<void>
  } = {},
): Promise<DownloadProgress> {
  const progress: DownloadProgress = { done: 0, failed: 0, total: urls.length }
  let next = 0

  const fetchOne = async (url: string): Promise<boolean> => {
    for (let attempt = 0; ; attempt++) {
      // Come le <img crossOrigin="anonymous">: risposta CORS, che la cache può salvare.
      const response = await fetcher(url, { mode: 'cors', credentials: 'omit', signal })
      if (response.ok) {
        // Il corpo va letto per intero, altrimenti la risposta non finisce in cache.
        await response.blob()
        return true
      }
      const busy = RETRY_STATUSES.has(response.status)
      if (!busy || attempt >= RETRIES || signal?.aborted) return false
      await wait(retryDelay(response, attempt))
    }
  }

  const worker = async () => {
    for (let url = urls[next++]; url !== undefined && !signal?.aborted; url = urls[next++]) {
      try {
        if (await fetchOne(url)) progress.done++
        else progress.failed++
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
  return allImageUrls(cards, (p) => p.setCode === setCode)
}

/** Le immagini (miniatura e grande) di tutte le Printing che ne hanno una. */
export function allImageUrls(
  cards: readonly CatalogCard[],
  include: (printing: CatalogCard['printings'][number]) => boolean = () => true,
): string[] {
  const urls: string[] = []
  for (const card of cards) {
    for (const p of card.printings) {
      if (!p.hasImage || !include(p)) continue
      urls.push(cardImageUrl(p.printId, 'thumb'), cardImageUrl(p.printId, 'full'))
    }
  }
  return urls
}

/** Stima dello spazio occupato da queste immagini, dal peso medio di miniature e grandi. */
export function estimateBytes(urls: readonly string[]): number {
  return urls.reduce(
    (sum, url) =>
      sum + (url.includes('/full/') ? IMAGE_AVERAGE_BYTES.full : IMAGE_AVERAGE_BYTES.thumb),
    0,
  )
}

/** Gli URL delle immagini già nelle cache del service worker. */
export async function cachedImageUrls(): Promise<Set<string>> {
  if (typeof caches === 'undefined') return new Set()
  const found = new Set<string>()
  for (const name of Object.values(IMAGE_CACHES)) {
    if (!(await caches.has(name))) continue
    for (const request of await (await caches.open(name)).keys()) found.add(request.url)
  }
  return found
}

/** Svuota le cache delle immagini: si riempiono di nuovo man mano che si guardano le carte. */
export async function clearImageCaches(): Promise<void> {
  if (typeof caches === 'undefined') return
  await Promise.all(Object.values(IMAGE_CACHES).map((name) => caches.delete(name)))
}
