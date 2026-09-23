import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

// Installazione della PWA (ADR-0001): invito discreto su Android, guida su iPhone/iPad,
// nessun invito automatico su desktop (solo una voce nel menu), niente se è già installata.

/** Evento di Chrome/Edge che permette di mostrare la finestra di installazione a comando. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export type InstallContext =
  /** Già aperta come app installata: nessun invito. */
  | 'installed'
  /** Android con Chrome/Edge: invito con il pulsante Installa. */
  | 'android'
  /** iPhone/iPad in Safari: guida Condividi → Aggiungi alla schermata Home. */
  | 'ios-safari'
  /** iPhone/iPad in un altro browser: spiegare di aprire con Safari. */
  | 'ios-other'
  /** Computer: nessun invito automatico. */
  | 'desktop'
  /** Telefono senza installazione disponibile (es. Firefox su Android): nessun invito. */
  | 'unsupported'

export interface Environment {
  userAgent: string
  /** navigator.platform e maxTouchPoints servono a riconoscere gli iPad che si presentano come Mac. */
  platform: string
  maxTouchPoints: number
  /** display-mode: standalone oppure navigator.standalone (iOS). */
  standalone: boolean
  /** Chrome/Edge hanno già offerto l'installazione (beforeinstallprompt). */
  canPrompt: boolean
}

const OTHER_IOS_BROWSERS = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|DuckDuckGo|YaBrowser/

export function detectInstallContext(env: Environment): InstallContext {
  if (env.standalone) return 'installed'

  const iPadAsMac = env.platform === 'MacIntel' && env.maxTouchPoints > 1
  const ios = /iPhone|iPad|iPod/.test(env.userAgent) || iPadAsMac
  if (ios) return OTHER_IOS_BROWSERS.test(env.userAgent) ? 'ios-other' : 'ios-safari'

  if (env.userAgent.includes('Android')) return env.canPrompt ? 'android' : 'unsupported'
  return 'desktop'
}

// ---- L'invito chiuso non riappare subito ----

export const INVITE_DISMISSED_KEY = 'op-codex-install-dismissed'
export const INVITE_PAUSE_DAYS = 30
const DAY = 24 * 60 * 60 * 1000

export function isInvitePaused(dismissedAt: number | null, now: number): boolean {
  return dismissedAt !== null && now - dismissedAt < INVITE_PAUSE_DAYS * DAY
}

function readDismissedAt(): number | null {
  try {
    const value = Number(localStorage.getItem(INVITE_DISMISSED_KEY))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

function writeDismissedAt(now: number): void {
  try {
    localStorage.setItem(INVITE_DISMISSED_KEY, String(now))
  } catch {
    /* senza storage l'invito tornerà alla prossima apertura */
  }
}

// ---- Evento beforeinstallprompt, catturato il prima possibile ----

let deferredPrompt: BeforeInstallPromptEvent | null = null
const listeners = new Set<() => void>()
const notify = () => {
  for (const listener of listeners) listener()
}

/** Da chiamare all'avvio (main.tsx): l'evento può arrivare prima che React disegni la pagina. */
export function captureInstallPrompt(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault() // niente mini-barra automatica: l'invito lo mostriamo noi
    deferredPrompt = event as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null
    notify()
  })
}

const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function isStandalone(): boolean {
  const iosStandalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  return iosStandalone || window.matchMedia('(display-mode: standalone)').matches
}

/** Stato dell'installazione per l'interfaccia. */
export function useInstall() {
  const prompt = useSyncExternalStore(subscribe, () => deferredPrompt)
  const [dismissedAt, setDismissedAt] = useState(readDismissedAt)
  const [now] = useState(() => Date.now())
  const [standalone, setStandalone] = useState(isStandalone)

  // Dopo l'installazione (o aprendo l'app installata) gli inviti spariscono.
  useEffect(() => {
    const query = window.matchMedia('(display-mode: standalone)')
    const update = () => {
      setStandalone(isStandalone())
    }
    query.addEventListener('change', update)
    window.addEventListener('appinstalled', update)
    return () => {
      query.removeEventListener('change', update)
      window.removeEventListener('appinstalled', update)
    }
  }, [])

  const context = detectInstallContext({
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
    standalone,
    canPrompt: prompt !== null,
  })

  const install = useCallback(async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    deferredPrompt = null // l'evento si usa una volta sola
    notify()
  }, [])

  const dismiss = useCallback(() => {
    const at = Date.now()
    writeDismissedAt(at)
    setDismissedAt(at)
  }, [])

  return {
    context,
    /** Mostrare l'invito automatico (telefono, non installata, non chiuso di recente). */
    showInvite:
      (context === 'android' || context === 'ios-safari' || context === 'ios-other') &&
      !isInvitePaused(dismissedAt, now),
    /** Voce "Installa l'app" nel menu desktop (Chrome/Edge). */
    canInstallFromMenu: context === 'desktop' && prompt !== null,
    install,
    dismiss,
  }
}
