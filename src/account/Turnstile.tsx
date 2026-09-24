import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useTheme } from '@/app/theme'

// CAPTCHA Cloudflare Turnstile (RIB-14) su registrazione, accesso e recupero password.
// Il token che produce lo verifica Supabase sul server; vale una volta sola, quindi dopo ogni
// invio del modulo il widget va azzerato (resetKey).
// CSP: script e iframe da challenges.cloudflare.com (netlify.toml).

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let loading: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_URL
    script.async = true
    script.onload = () => {
      if (window.turnstile) resolve(window.turnstile)
      else reject(new Error('Turnstile non disponibile'))
    }
    script.onerror = () => {
      loading = null
      reject(new Error('Turnstile non caricato'))
    }
    document.head.appendChild(script)
  })
  return loading
}

export function Turnstile({
  onToken,
  resetKey,
}: {
  /** Il token appena ottenuto, oppure null se scaduto o in errore. */
  onToken: (token: string | null) => void
  /** Cambiarlo azzera il widget (il token è già stato usato). */
  resetKey: number
}) {
  const { t, i18n } = useTranslation()
  const { preference } = useTheme()
  const theme = preference === 'system' ? 'auto' : preference
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const callback = useRef(onToken)
  useEffect(() => {
    callback.current = onToken
  })
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!siteKey || !container.current) return
    const element = container.current
    let cancelled = false
    loadTurnstile()
      .then((api) => {
        if (cancelled) return
        widget.current = api.render(element, {
          sitekey: siteKey,
          language: i18n.language,
          theme,
          callback: (token: string) => {
            callback.current(token)
          },
          'expired-callback': () => {
            callback.current(null)
          },
          'error-callback': () => {
            callback.current(null)
          },
        })
      })
      .catch(() => {
        callback.current(null)
      })
    return () => {
      cancelled = true
      if (widget.current) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [siteKey, i18n.language, theme])

  useEffect(() => {
    if (resetKey === 0 || !widget.current) return
    callback.current(null)
    window.turnstile?.reset(widget.current)
  }, [resetKey])

  if (!siteKey) {
    return <p className="text-sm text-destructive">{t('account.captchaMissing')}</p>
  }
  return <div ref={container} className="min-h-[65px]" />
}
