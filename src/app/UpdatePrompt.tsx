import { RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRegisterSW } from 'virtual:pwa-register/react'

// Registra il service worker e, quando esce una nuova versione, lo dice invece di
// aggiornare di nascosto (vite.config.ts: registerType 'prompt').

const CHECK_EVERY_MS = 60 * 60 * 1000

export function UpdatePrompt() {
  const { t } = useTranslation()
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Registra subito: quando React monta questo componente l'evento "load" è già passato.
    immediate: true,
    // L'app installata può restare aperta a lungo: controlla gli aggiornamenti ogni ora.
    onRegisteredSW(_url, registration) {
      if (!registration) return
      setInterval(() => {
        void registration.update()
      }, CHECK_EVERY_MS)
    },
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-2xl border bg-background p-3 pl-4 text-sm shadow-2xl lg:top-auto lg:right-6 lg:bottom-6 lg:left-auto lg:mx-0"
    >
      <RefreshCw className="size-4 shrink-0" aria-hidden="true" />
      <span className="flex-1 font-medium">{t('update.available')}</span>
      <button
        type="button"
        onClick={() => {
          setNeedRefresh(false)
        }}
        className="h-9 rounded-full px-3 text-muted-foreground hover:text-foreground"
      >
        {t('update.later')}
      </button>
      <button
        type="button"
        onClick={() => {
          void updateServiceWorker(true)
        }}
        className="h-9 rounded-full bg-foreground px-4 font-medium text-background"
      >
        {t('update.reload')}
      </button>
    </div>
  )
}
