export const RULES_PATH = '/regole'
/** La voce del glossario da evidenziare. */
export const ENTRY_PARAM = 'voce'
export const SEARCH_PARAM = 'q'
/** Una regola del regolamento da leggere nel suo contesto (RIB-53). */
export const RULE_PARAM = 'regola'

/** Il link alla voce del glossario di un'altra pagina (es. dal dettaglio di una Card). */
export function glossaryPath(entryId: string): string {
  return `${RULES_PATH}?${new URLSearchParams({ [ENTRY_PARAM]: entryId }).toString()}`
}

/** Il link a una regola del regolamento ("10-1-4"). */
export function rulePath(n: string): string {
  return `${RULES_PATH}?${new URLSearchParams({ [RULE_PARAM]: n }).toString()}`
}
