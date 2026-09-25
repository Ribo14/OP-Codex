/**
 * Copia un testo negli appunti. Usa l'API moderna; se manca o è bloccata (browser vecchi, alcune
 * WebView), ripiega su un campo nascosto e il comando di copia. Deve partire da un tocco
 * dell'utente, altrimenti iOS la rifiuta. Restituisce true se è riuscita.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    area.setSelectionRange(0, text.length)
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- ripiego per chi non ha l'API moderna
    const done = document.execCommand('copy')
    area.remove()
    return done
  }
}

/** Condivisione del sistema (menu con WhatsApp, Messaggi…), dove c'è: di solito sui telefoni. */
export function canShare(): boolean {
  return typeof navigator.share === 'function'
}
