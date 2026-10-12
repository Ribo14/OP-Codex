import type { Session } from '@supabase/supabase-js'

// La sessione che la libreria di Supabase tiene salvata nel browser (localStorage), letta
// direttamente. Serve offline (RIB-27): senza rete la libreria non riesce a rinnovare un token
// di accesso scaduto e dice "nessuna sessione", ma la sessione resta salvata finché il server
// non la rifiuta davvero (es. "Esci ovunque"); intanto l'app resta collegata e usa le copie
// sul dispositivo.

/** La chiave predefinita di supabase-js: "sb-<primo pezzo dell'host>-auth-token". */
export function sessionStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0] ?? ''}-auth-token`
}

/** La sessione salvata, se ha un utente e un refresh token; altrimenti null. */
export function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as Partial<Session> | null
    if (
      typeof session?.access_token === 'string' &&
      typeof session.refresh_token === 'string' &&
      typeof session.user?.id === 'string'
    ) {
      return session as Session
    }
  } catch {
    /* contenuto illeggibile: come se non ci fosse */
  }
  return null
}

export function readStoredSession(
  supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL,
): Session | null {
  if (!supabaseUrl) return null
  try {
    return parseStoredSession(localStorage.getItem(sessionStorageKey(supabaseUrl)))
  } catch {
    // localStorage non disponibile (navigazione privata rigida, test): nessuna sessione.
    return null
  }
}
