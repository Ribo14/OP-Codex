export const RULES_PATH = '/regole'
/** La voce del glossario da evidenziare. */
export const ENTRY_PARAM = 'voce'
export const SEARCH_PARAM = 'q'

/** Il link alla voce del glossario di un'altra pagina (es. dal dettaglio di una Card). */
export function glossaryPath(entryId: string): string {
  return `${RULES_PATH}?${new URLSearchParams({ [ENTRY_PARAM]: entryId }).toString()}`
}
