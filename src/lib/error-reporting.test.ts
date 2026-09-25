import type { ErrorEvent } from '@sentry/browser'
import { describe, expect, it } from 'vitest'
import { scrubEvent, scrubUrl } from './error-reporting'

describe('segnalazione degli errori senza dati personali', () => {
  it('indirizzi: via query, frammento, token degli Share Link e id dei Deck', () => {
    expect(scrubUrl('https://op-codex.netlify.app/m/AbC_123-xyzAbC_123-xyzA?x=1#y')).toBe(
      'https://op-codex.netlify.app/m/:token',
    )
    expect(
      scrubUrl('https://op-codex.netlify.app/mazzi/6f1c2a4e-1b2c-4d3e-8f90-123456789abc/leader'),
    ).toBe('https://op-codex.netlify.app/mazzi/:id/leader')
    expect(scrubUrl('https://op-codex.netlify.app/?q=zoro&colore=Red')).toBe(
      'https://op-codex.netlify.app/',
    )
  })

  it('evento: niente utente, breadcrumb, extra né intestazioni', () => {
    const event: ErrorEvent = {
      type: undefined,
      message: 'Boom',
      user: { id: 'u1', email: 'anna@example.com', ip_address: '1.2.3.4' },
      breadcrumbs: [{ message: 'click on Anna' }],
      extra: { input: 'segreto' },
      request: {
        url: 'https://op-codex.netlify.app/m/tokenSegreto1234567890?a=1',
        headers: { 'User-Agent': 'x', Cookie: 'sb=1' },
        query_string: 'a=1',
      },
      exception: {
        values: [
          {
            type: 'Error',
            value: 'Boom',
            stacktrace: {
              frames: [{ filename: 'https://op-codex.netlify.app/assets/index-abc.js?v=1' }],
            },
          },
        ],
      },
    }
    const clean = scrubEvent(event)
    expect(clean.user).toBeUndefined()
    expect(clean.breadcrumbs).toBeUndefined()
    expect(clean.extra).toBeUndefined()
    expect(clean.request).toEqual({ url: 'https://op-codex.netlify.app/m/:token' })
    expect(clean.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename).toBe(
      'https://op-codex.netlify.app/assets/index-abc.js',
    )
    expect(JSON.stringify(clean)).not.toMatch(/anna|1\.2\.3\.4|segreto|Cookie|tokenSegreto/i)
  })
})
