import { isAuthError } from '@supabase/supabase-js'

// Errori di Supabase Auth tradotti in messaggi per l'utente (RIB-14). I messaggi non dicono mai
// se un'email è registrata: credenziali sbagliate ed email non confermata danno lo stesso testo.

export type AuthProblem =
  'credentials' | 'weakPassword' | 'captcha' | 'rateLimit' | 'samePassword' | 'network' | 'generic'

export function authProblem(error: unknown): AuthProblem {
  if (!isAuthError(error)) return 'generic'
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
      if (error.name === 'AuthRetryableFetchError') return 'network'
      return 'generic'
  }
}
