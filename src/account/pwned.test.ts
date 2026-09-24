import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { isPwnedPassword } from './pwned'

// Impronta SHA-1 di "password", calcolata qui con Node: il servizio riceve i primi 5 caratteri
// e risponde con i restanti 35 delle impronte trapelate.
const HASH = createHash('sha1').update('password').digest('hex').toUpperCase()
const PREFIX = HASH.slice(0, 5)
const SUFFIX = HASH.slice(5)

const answer = (body: string, status = 200) =>
  vi.fn<typeof fetch>(() => Promise.resolve(new Response(body, { status })))

describe('password trapelate (Have I Been Pwned)', () => {
  it('manda al servizio solo i primi 5 caratteri dell’impronta, con il riempimento', async () => {
    const fetcher = answer('')
    await isPwnedPassword('password', fetcher)
    const [url, init] = fetcher.mock.calls[0] ?? []
    // Solo il prefisso dell'impronta: nessuna traccia della password.
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${PREFIX}`)
    expect(new Headers(init?.headers).get('Add-Padding')).toBe('true')
  })

  it('riconosce una password trapelata', async () => {
    const fetcher = answer(`0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${SUFFIX}:10434004\r\n`)
    expect(await isPwnedPassword('password', fetcher)).toBe(true)
  })

  it('una password assente dall’elenco va bene; le righe di riempimento (0) non contano', async () => {
    const fetcher = answer(`0018A45C4D1DEF81644B54AB7F969B88D65:1\r\n${SUFFIX}:0\r\n`)
    expect(await isPwnedPassword('password', fetcher)).toBe(false)
  })

  it('se il servizio non risponde non blocca (null)', async () => {
    expect(await isPwnedPassword('password', answer('', 503))).toBeNull()
    expect(
      await isPwnedPassword('password', () => Promise.reject(new TypeError('offline'))),
    ).toBeNull()
  })
})
