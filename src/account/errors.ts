import {
  isAuthError,
  isAuthRetryableFetchError,
  isAuthWeakPasswordError,
} from '@supabase/supabase-js'

// Errori di Supabase Auth tradotti in messaggi per l'utente (RIB-14). I messaggi non dicono mai
// se un'email è registrata: credenziali sbagliate ed email non confermata danno lo stesso testo.

export type AuthProblem =
  | 'credentials'
  | 'weakPassword'
  | 'weakCharacters'
  | 'pwned'
  | 'captcha'
  | 'rateLimit'
  | 'samePassword'
  | 'network'
  | 'server'
  | 'generic'

export function authProblem(error: unknown): AuthProblem {
  if (!isAuthError(error)) return 'generic'
  // Password rifiutata da Supabase: il motivo conta (lunghezza, tipi di caratteri, trapelata).
  if (isAuthWeakPasswordError(error)) {
    if (error.reasons.includes('characters')) return 'weakCharacters'
    if (error.reasons.includes('pwned')) return 'pwned'
    return 'weakPassword'
  }
  // Nessuna risposta (status 0) = rete; 5xx = il server (o l'invio dell'email) non ce l'ha fatta.
  if (isAuthRetryableFetchError(error)) return error.status === 0 ? 'network' : 'server'
  switch (error.code) {
    case 'invalid_credentials':
    case 'email_not_confirmed':
      return 'credentials'
    case 'weak_password':
      return 'weakPassword'
    case 'captcha_failed':
      return 'captcha'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rateLimit'
    case 'same_password':
      return 'samePassword'
    default:
      if (error.status === 429) return 'rateLimit'
      if (error.status !== undefined && error.status >= 500) return 'server'
      return 'generic'
  }
}
