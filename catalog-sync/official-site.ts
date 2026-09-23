import { isPrintId } from './card-list-parser.ts'

// Accesso alla Official Card List. Il Catalog Sync deve essere educato (ADR-0004):
// poche richieste, sequenziali, con uno User-Agent che dica chi siamo.

export const OFFICIAL_SITE = 'https://en.onepiece-cardgame.com'

export const USER_AGENT = 'OP-Codex Catalog Sync (+https://github.com/Ribo14/OP-Codex)'

const TIMEOUT_MS = 30_000

/** Attese prima di ogni nuovo tentativo: il sito ufficiale a volte è lento o va in timeout. */
export const RETRY_DELAYS_MS = [10_000, 30_000] as const

export interface FetchOptions {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
}

export class HttpError extends Error {
  readonly status: number

  constructor(status: number, url: string) {
    super(`HTTP ${String(status)} per ${url}`)
    this.name = 'HttpError'
    this.status = status
  }
}

/** Si riprova su timeout ed errori di rete, sui 429 e sui 5xx; non su un 404 o un 403. */
function isRetryable(error: unknown): boolean {
  if (error instanceof HttpError) return error.status === 429 || error.status >= 500
  return true
}

async function withRetries<T>(fn: () => Promise<T>, options: FetchOptions): Promise<T> {
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn()
    } catch (error) {
      const wait = RETRY_DELAYS_MS[attempt]
      if (wait === undefined || !isRetryable(error)) throw error
      await sleep(wait)
    }
  }
}

async function get(url: string, accept: string, options: FetchOptions): Promise<Response> {
  const fetchImpl = options.fetchImpl ?? fetch
  return withRetries(async () => {
    const response = await fetchImpl(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: accept },
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new HttpError(response.status, url)
    return response
  }, options)
}

/** Scarica il PNG ufficiale di una Printing. */
export async function fetchCardImage(
  printId: string,
  options: FetchOptions = {},
): Promise<Uint8Array> {
  if (!isPrintId(printId)) throw new Error(`Print ID non valido: ${printId}`)

  const response = await get(
    `${OFFICIAL_SITE}/images/cardlist/card/${printId}.png`,
    'image/png',
    options,
  )
  const contentType = response.headers.get('content-type') ?? ''
  if (!contentType.startsWith('image/')) throw new Error(`Non è un'immagine (${contentType})`)
  return new Uint8Array(await response.arrayBuffer())
}

/** Scarica la pagina di un Set: una sola richiesta restituisce tutte le sue carte. */
export async function fetchSetPage(seriesId: number, options: FetchOptions = {}): Promise<string> {
  if (!Number.isInteger(seriesId) || seriesId <= 0) {
    throw new Error(`Identificativo del Set non valido: ${String(seriesId)}`)
  }

  const response = await get(
    `${OFFICIAL_SITE}/cardlist/?series=${String(seriesId)}`,
    'text/html',
    options,
  )
  return response.text()
}
