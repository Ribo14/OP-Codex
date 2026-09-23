// Indirizzi del dettaglio di una Card. I filtri della ricerca restano nell'URL,
// così aprire e chiudere il dettaglio non li perde.

/** Parametro dell'URL con la Printing scelta nel dettaglio (es. ?stampa=OP01-001_p1). */
export const PRINTING_PARAM = 'stampa'

function withoutPrinting(search: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(search)
  params.delete(PRINTING_PARAM)
  return params
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString()
  return query ? `${path}?${query}` : path
}

export function cardPath(cardCode: string, search: URLSearchParams, printId?: string): string {
  const params = withoutPrinting(search)
  if (printId && printId !== cardCode) params.set(PRINTING_PARAM, printId)
  return withQuery(`/carta/${encodeURIComponent(cardCode)}`, params)
}

export function catalogPath(search: URLSearchParams): string {
  return withQuery('/', withoutPrinting(search))
}
