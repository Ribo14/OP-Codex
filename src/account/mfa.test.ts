import type { Factor, Session, User } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'
import { cleanCode, needsCode, qrSource, sessionLevel, verifiedTotp } from './mfa'

function token(claims: object): string {
  const payload = btoa(JSON.stringify(claims)).replace(/\+/g, '-').replace(/\//g, '_')
  return `header.${payload.replace(/=+$/, '')}.firma`
}

function factor(status: Factor['status']): Factor {
  return { id: 'f1', factor_type: 'totp', status, created_at: '', updated_at: '' }
}

function session(aal: string, factors: Factor[] = []): Session {
  return { access_token: token({ aal }), user: { factors } as unknown as User } as Session
}

describe('verifica in due passaggi', () => {
  it('legge il livello dal token', () => {
    expect(sessionLevel(token({ aal: 'aal2', sub: 'x' }))).toBe('aal2')
    expect(sessionLevel('non-un-token')).toBeNull()
    expect(sessionLevel('a.%%%.b')).toBeNull()
  })

  it('chiede il codice solo a chi ha un fattore confermato e non l’ha ancora dato', () => {
    expect(needsCode(session('aal1'))).toBe(false)
    expect(needsCode(session('aal1', [factor('unverified')]))).toBe(false)
    expect(needsCode(session('aal1', [factor('verified')]))).toBe(true)
    expect(needsCode(session('aal2', [factor('verified')]))).toBe(false)
  })

  it('trova il fattore confermato', () => {
    const user = { factors: [factor('unverified'), factor('verified')] } as unknown as User
    expect(verifiedTotp(user)?.status).toBe('verified')
    expect(verifiedTotp({} as User)).toBeUndefined()
  })

  it('accetta 6 cifre, anche con spazi', () => {
    expect(cleanCode('123 456')).toBe('123456')
    expect(cleanCode('12345')).toBeNull()
    expect(cleanCode('12345a')).toBeNull()
  })

  it('prepara l’immagine del QR code', () => {
    expect(qrSource('data:image/svg+xml;utf-8,<svg/>')).toBe('data:image/svg+xml;utf-8,<svg/>')
    expect(qrSource('<svg a="#"/>')).toBe(
      'data:image/svg+xml;charset=utf-8,%3Csvg%20a%3D%22%23%22%2F%3E',
    )
  })
})
