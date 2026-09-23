import { describe, expect, it } from 'vitest'
import {
  detectInstallContext,
  INVITE_PAUSE_DAYS,
  isInvitePaused,
  type Environment,
} from './install'

const UA = {
  androidChrome:
    'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36',
  androidFirefox: 'Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0',
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0 Mobile/15E148 Safari/604.1',
  ipadAsMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15',
  windowsChrome:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
}

const env = (partial: Partial<Environment>): Environment => ({
  userAgent: UA.windowsChrome,
  platform: 'Win32',
  maxTouchPoints: 0,
  standalone: false,
  canPrompt: false,
  ...partial,
})

describe('detectInstallContext', () => {
  it('app già installata: nessun invito, su qualsiasi piattaforma', () => {
    expect(detectInstallContext(env({ standalone: true, userAgent: UA.iphoneSafari }))).toBe(
      'installed',
    )
    expect(detectInstallContext(env({ standalone: true, userAgent: UA.androidChrome }))).toBe(
      'installed',
    )
  })

  it('Android: invito solo se il browser offre l’installazione', () => {
    expect(detectInstallContext(env({ userAgent: UA.androidChrome, canPrompt: true }))).toBe(
      'android',
    )
    expect(detectInstallContext(env({ userAgent: UA.androidFirefox }))).toBe('unsupported')
  })

  it('iPhone: guida in Safari, "apri con Safari" negli altri browser', () => {
    expect(detectInstallContext(env({ userAgent: UA.iphoneSafari }))).toBe('ios-safari')
    expect(detectInstallContext(env({ userAgent: UA.iphoneChrome }))).toBe('ios-other')
  })

  it('riconosce l’iPad anche quando si presenta come un Mac', () => {
    expect(
      detectInstallContext(
        env({ userAgent: UA.ipadAsMac, platform: 'MacIntel', maxTouchPoints: 5 }),
      ),
    ).toBe('ios-safari')
    // Un Mac vero non ha il touch.
    expect(
      detectInstallContext(
        env({ userAgent: UA.ipadAsMac, platform: 'MacIntel', maxTouchPoints: 0 }),
      ),
    ).toBe('desktop')
  })

  it('computer: desktop, anche se Chrome offre l’installazione', () => {
    expect(detectInstallContext(env({ canPrompt: true }))).toBe('desktop')
  })
})

describe('isInvitePaused', () => {
  const now = Date.UTC(2026, 8, 23)
  const day = 24 * 60 * 60 * 1000

  it('mai chiuso: l’invito si mostra', () => {
    expect(isInvitePaused(null, now)).toBe(false)
  })

  it(`chiuso: non riappare per ${String(INVITE_PAUSE_DAYS)} giorni`, () => {
    expect(isInvitePaused(now - day, now)).toBe(true)
    expect(isInvitePaused(now - (INVITE_PAUSE_DAYS - 1) * day, now)).toBe(true)
    expect(isInvitePaused(now - INVITE_PAUSE_DAYS * day, now)).toBe(false)
  })
})
