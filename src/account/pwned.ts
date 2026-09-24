// Controllo delle password trapelate con Have I Been Pwned (RIB-14, OWASP ASVS 2.1.7).
// k-anonymity: al servizio va solo l'inizio (5 caratteri) dell'impronta SHA-1 della password;
// la password e l'impronta completa non lasciano mai il dispositivo.
// Nel piano gratuito di Supabase il controllo lato server non è disponibile: lo fa l'app prima
// di inviare la password. Supabase verifica comunque la lunghezza minima.

const RANGE_URL = 'https://api.pwnedpasswords.com/range/'

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()
}

/**
 * true se la password compare in violazioni note, false se no, null se il controllo non è
 * riuscito (rete assente o servizio irraggiungibile): in quel caso non si blocca l'utente.
 */
export async function isPwnedPassword(
  password: string,
  fetcher: typeof fetch = fetch,
): Promise<boolean | null> {
  try {
    const hash = await sha1Hex(password)
    const prefix = hash.slice(0, 5)
    const suffix = hash.slice(5)
    // Add-Padding: la risposta ha sempre una lunghezza simile, anche a chi osserva la rete.
    const response = await fetcher(RANGE_URL + prefix, {
      headers: { 'Add-Padding': 'true' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    })
    if (!response.ok) return null
    for (const line of (await response.text()).split('\n')) {
      const [candidate, count] = line.trim().split(':')
      // Le righe di riempimento hanno conteggio 0.
      if (candidate === suffix && Number(count) > 0) return true
    }
    return false
  } catch {
    return null
  }
}
