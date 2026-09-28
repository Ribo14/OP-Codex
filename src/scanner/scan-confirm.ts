// Lettura continua dello Scanner (RIB-68): l'OCR legge un fotogramma dopo l'altro e sbaglia ogni
// tanto; una carta si propone solo quando lo stesso Card Code (già filtrato sul catalogo) arriva
// in `needed` letture di fila. Codice puro: il giro delle letture sta in ScannerPage.

export interface Confirmer {
  /** Riceve i codici trovati in una lettura; restituisce il codice confermato, altrimenti null. */
  push: (found: readonly string[]) => string | null
  /**
   * Ignora un codice finché non sparisce dalle letture: dopo un'aggiunta o un "Non è questa" la
   * carta è ancora davanti alla fotocamera e non va riproposta subito.
   */
  block: (code: string) => void
}

export function createConfirmer(needed = 2): Confirmer {
  let code: string | null = null
  let streak = 0
  let blocked: string | null = null
  return {
    push(found) {
      if (blocked !== null && !found.includes(blocked)) blocked = null
      const [first = null] = found.filter((c) => c !== blocked)
      streak = first !== null && first === code ? streak + 1 : first === null ? 0 : 1
      code = first
      if (code === null || streak < needed) return null
      streak = 0
      return code
    },
    block(value) {
      blocked = value
      code = null
      streak = 0
    },
  }
}
