import { AuthApiError, AuthRetryableFetchError, AuthWeakPasswordError } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { authProblem } from './errors'

describe('errori di accesso e registrazione', () => {
  it('credenziali sbagliate ed email non confermata danno lo stesso messaggio', () => {
    expect(authProblem(new AuthApiError('x', 400, 'invalid_credentials'))).toBe('credentials')
    expect(authProblem(new AuthApiError('x', 400, 'email_not_confirmed'))).toBe('credentials')
  })

  it('una password rifiutata dal server dice il motivo', () => {
    expect(authProblem(new AuthWeakPasswordError('x', 422, ['length']))).toBe('weakPassword')
    expect(authProblem(new AuthWeakPasswordError('x', 422, ['characters']))).toBe('weakCharacters')
    expect(authProblem(new AuthWeakPasswordError('x', 422, ['pwned']))).toBe('pwned')
  })

  it('distingue la rete assente da un server che non risponde in tempo', () => {
    expect(authProblem(new AuthRetryableFetchError('Failed to fetch', 0))).toBe('network')
    expect(authProblem(new AuthRetryableFetchError('Gateway Timeout', 504))).toBe('server')
    expect(
      authProblem(new AuthApiError('Error sending confirmation email', 500, 'unexpected_failure')),
    ).toBe('server')
  })

  it('CAPTCHA e troppi tentativi', () => {
    expect(authProblem(new AuthApiError('x', 400, 'captcha_failed'))).toBe('captcha')
    expect(authProblem(new AuthApiError('x', 429, 'over_email_send_rate_limit'))).toBe('rateLimit')
  })
})
