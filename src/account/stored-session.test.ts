import { afterEach, describe, expect, it } from 'vitest'
import { parseStoredSession, readStoredSession, sessionStorageKey } from './stored-session'

const SESSION = {
  access_token: 'a',
  refresh_token: 'r',
  expires_at: 1,
  user: { id: '00000000-0000-0000-0000-000000000001' },
}

describe('sessione salvata (offline, RIB-27)', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('la chiave è quella predefinita di supabase-js', () => {
    expect(sessionStorageKey('https://abcdefgh.supabase.co')).toBe('sb-abcdefgh-auth-token')
    expect(sessionStorageKey('http://127.0.0.1:54321')).toBe('sb-127-auth-token')
  })

  it('vale solo una sessione con token, refresh token e utente, anche se scaduta', () => {
    expect(parseStoredSession(JSON.stringify(SESSION))?.user.id).toBe(SESSION.user.id)
    expect(parseStoredSession(null)).toBeNull()
    expect(parseStoredSession('non json')).toBeNull()
    expect(parseStoredSession('null')).toBeNull()
    expect(parseStoredSession(JSON.stringify({ ...SESSION, refresh_token: undefined }))).toBeNull()
    expect(parseStoredSession(JSON.stringify({ ...SESSION, user: null }))).toBeNull()
  })

  it('si legge da localStorage; senza URL o senza sessione, null', () => {
    const url = 'https://abcdefgh.supabase.co'
    expect(readStoredSession(url)).toBeNull()
    localStorage.setItem(sessionStorageKey(url), JSON.stringify(SESSION))
    expect(readStoredSession(url)?.refresh_token).toBe('r')
    expect(readStoredSession('')).toBeNull()
  })
})
