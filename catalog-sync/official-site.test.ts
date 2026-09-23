import { describe, expect, it } from 'vitest'
import { fetchSetPage, HttpError, RETRY_DELAYS_MS, USER_AGENT } from './official-site.ts'

function fakeFetch(responses: (Response | Error)[]) {
  const calls: { url: string; userAgent: string | null }[] = []
  const fetchImpl = ((url: string, init?: RequestInit) => {
    calls.push({ url, userAgent: new Headers(init?.headers).get('User-Agent') })
    const next = responses.shift()
    if (!next) throw new Error('nessuna risposta preparata')
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next)
  }) as typeof fetch
  return { fetchImpl, calls }
}

function recordSleeps() {
  const sleeps: number[] = []
  return {
    sleeps,
    sleep: (ms: number) => {
      sleeps.push(ms)
      return Promise.resolve()
    },
  }
}

describe('fetchSetPage', () => {
  it('chiede la pagina del Set presentandosi con il nostro User-Agent', async () => {
    const { fetchImpl, calls } = fakeFetch([new Response('<html>ok</html>')])

    expect(await fetchSetPage(569101, { fetchImpl })).toBe('<html>ok</html>')
    expect(calls).toEqual([
      {
        url: 'https://en.onepiece-cardgame.com/cardlist/?series=569101',
        userAgent: USER_AGENT,
      },
    ])
  })

  it('riprova dopo un timeout o un errore del server, con attese crescenti', async () => {
    const { fetchImpl, calls } = fakeFetch([
      new DOMException('The operation was aborted due to timeout', 'TimeoutError'),
      new Response('', { status: 503 }),
      new Response('<html>ok</html>'),
    ])
    const { sleep, sleeps } = recordSleeps()

    expect(await fetchSetPage(569101, { fetchImpl, sleep })).toBe('<html>ok</html>')
    expect(calls).toHaveLength(3)
    expect(sleeps).toEqual([...RETRY_DELAYS_MS])
  })

  it('si arrende dopo i tentativi previsti', async () => {
    const { fetchImpl, calls } = fakeFetch([
      new Response('', { status: 500 }),
      new Response('', { status: 500 }),
      new Response('', { status: 500 }),
    ])
    const { sleep } = recordSleeps()

    await expect(fetchSetPage(569101, { fetchImpl, sleep })).rejects.toThrow(HttpError)
    expect(calls).toHaveLength(RETRY_DELAYS_MS.length + 1)
  })

  it('non riprova su un 404', async () => {
    const { fetchImpl, calls } = fakeFetch([new Response('', { status: 404 })])
    const { sleep, sleeps } = recordSleeps()

    await expect(fetchSetPage(569101, { fetchImpl, sleep })).rejects.toThrow('HTTP 404')
    expect(calls).toHaveLength(1)
    expect(sleeps).toEqual([])
  })
})
