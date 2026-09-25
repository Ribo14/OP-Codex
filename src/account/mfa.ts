import type { Factor, Session, User } from '@supabase/supabase-js'

// Verifica in due passaggi (RIB-18): codice di 6 cifre da un'app come Google Authenticator.
// Il database fa rispettare la regola da solo (private.accesso_valido); qui l'app sa quando
// chiedere il codice.

export const CODE_LENGTH = 6

/** Il fattore TOTP confermato dell'utente, se ha attivato la verifica in due passaggi. */
export function verifiedTotp(user: User): Factor | undefined {
  return user.factors?.find((f) => f.factor_type === 'totp' && f.status === 'verified')
}

/** Livello di accesso scritto nel token (aal1 = solo password o Google, aal2 = anche il codice). */
export function sessionLevel(accessToken: string): string | null {
  const payload = accessToken.split('.')[1]
  if (!payload) return null
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(json) as { aal?: unknown }
    return typeof claims.aal === 'string' ? claims.aal : null
  } catch {
    return null
  }
}

/** Vero se l'utente ha la verifica in due passaggi ma in questa sessione non ha ancora dato il codice. */
export function needsCode(session: Session): boolean {
  return verifiedTotp(session.user) !== undefined && sessionLevel(session.access_token) !== 'aal2'
}

/** Il codice scritto dall'utente, senza spazi; null se non sono 6 cifre. */
export function cleanCode(input: string): string | null {
  const code = input.replace(/\s/g, '')
  return code.length === CODE_LENGTH && /^\d+$/.test(code) ? code : null
}

/** Immagine del QR code: Supabase la dà come SVG, a volte già come indirizzo data:. */
export function qrSource(qrCode: string): string {
  return qrCode.startsWith('data:')
    ? qrCode
    : `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrCode)}`
}
