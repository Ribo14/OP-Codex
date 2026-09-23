// Accesso alla Official Card List. Il Catalog Sync deve essere educato (ADR-0004):
// poche richieste, sequenziali, con uno User-Agent che dica chi siamo.

export const OFFICIAL_SITE = 'https://en.onepiece-cardgame.com'

export const USER_AGENT = 'OP-Codex Catalog Sync (+https://github.com/Ribo14/OP-Codex)'

const TIMEOUT_MS = 30_000

/** Scarica la pagina di un Set: una sola richiesta restituisce tutte le sue carte. */
export async function fetchSetPage(seriesId: number, fetchImpl = fetch): Promise<string> {
  if (!Number.isInteger(seriesId) || seriesId <= 0) {
    throw new Error(`Identificativo del Set non valido: ${String(seriesId)}`)
  }

  const url = `${OFFICIAL_SITE}/cardlist/?series=${String(seriesId)}`
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
    redirect: 'error',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) {
    throw new Error(`Official Card List: HTTP ${String(response.status)} per ${url}`)
  }
  return response.text()
}
