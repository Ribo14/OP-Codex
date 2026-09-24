import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import { Download, LogIn, Settings, WifiOff } from 'lucide-react'
import {
  CONFIRM_PATH,
  LOGIN_PATH,
  NEW_PASSWORD_PATH,
  RECOVER_PATH,
  SIGNUP_PATH,
} from '@/account/paths'
import { loginPath } from '@/account/return-path'
import { useSession } from '@/account/session'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'
import { useInstall } from './install'
import { InstallInvite } from './InstallInvite'
import { PRIVACY_PATH, SECTIONS, SETTINGS_PATH } from './sections'
import { ThemeCycleButton, ThemeSegmented } from './ThemeToggle'

// Struttura dell'app (docs/design.md): barra in basso su telefono, barra laterale da `lg`.

/** Pagine di account: lì "Accedi" nell'intestazione sarebbe un doppione. */
const ACCOUNT_PATHS = [LOGIN_PATH, SIGNUP_PATH, RECOVER_PATH, CONFIRM_PATH, NEW_PASSWORD_PATH]

export function AppShell() {
  const { t } = useTranslation()
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  // Il dettaglio di una Card (/carta/...) fa parte del Catalogo: aprirlo non cambia sezione.
  const inCardDetail = pathname.startsWith('/carta/')
  const sectionPath = inCardDetail ? '/' : pathname
  const isActive = (path: string) => (path === '/' ? sectionPath === '/' : sectionPath === path)
  const { context, showInvite, canInstallFromMenu, install, dismiss } = useInstall()

  // A ogni cambio di sezione si riparte dall'alto (aprire una carta non perde la posizione).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [sectionPath])

  return (
    // safe-x: in orizzontale su iPhone il contenuto resta fuori dal notch (vedi index.css).
    <div className="flex h-svh bg-background safe-x text-foreground">
      <a
        href="#contenuto"
        className="sr-only z-50 rounded-full bg-foreground px-4 py-2 text-background focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        {t('app.skipToContent')}
      </a>

      {/* Desktop: barra laterale */}
      <aside className="hidden w-60 shrink-0 flex-col border-r lg:flex">
        <Link
          to="/"
          className="px-6 py-6 text-lg font-semibold tracking-tight focus-visible:underline focus-visible:outline-none"
        >
          {t('app.name')}
        </Link>
        <OfflineBadge className="mx-6 mb-4" />
        <nav aria-label={t('nav.label')} className="flex flex-col gap-1 px-3">
          {SECTIONS.map((section) => (
            <Link
              key={section.key}
              to={section.path}
              aria-current={isActive(section.path) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                isActive(section.path)
                  ? 'bg-foreground font-medium text-background'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <section.icon className="size-[18px]" aria-hidden="true" />
              {t(`nav.${section.key}`)}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-4 px-6 py-5">
          <LoginLink className="h-10 w-full" />
          <Link
            to={SETTINGS_PATH}
            aria-current={pathname === SETTINGS_PATH ? 'page' : undefined}
            className={cn(
              'flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              pathname === SETTINGS_PATH
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Settings className="size-4" aria-hidden="true" />
            {t('settings.title')}
          </Link>
          {canInstallFromMenu && (
            <button
              type="button"
              onClick={() => {
                void install()
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <Download className="size-4" aria-hidden="true" />
              {t('install.menu')}
            </button>
          )}
          <ThemeSegmented />
          <Footer />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Telefono: intestazione, sotto la barra di stato di iPhone (box-content: 3.5rem più l'area sicura) */}
        <header className="box-content flex h-14 shrink-0 items-center gap-3 border-b border-border/60 px-4 safe-top lg:hidden">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            {t('app.name')}
          </Link>
          <div className="-mr-2 ml-auto flex items-center gap-1">
            <OfflineBadge className="mr-1" />
            <LoginLink className="mr-1 h-9 px-3" />
            <ThemeCycleButton />
            <Link
              to={SETTINGS_PATH}
              aria-label={t('settings.title')}
              title={t('settings.title')}
              aria-current={pathname === SETTINGS_PATH ? 'page' : undefined}
              className="inline-flex size-10 items-center justify-center rounded-full text-foreground/80 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:bg-muted"
            >
              <Settings className="size-5" aria-hidden="true" />
            </Link>
          </div>
        </header>

        <main
          id="contenuto"
          ref={mainRef}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto focus:outline-none"
        >
          <div className="mx-auto w-full max-w-[1600px] px-4 pt-5 pb-8 lg:px-8 lg:pt-8">
            <Outlet />
          </div>
          {/* Telefono: avviso e privacy in fondo a ogni pagina, sopra la barra */}
          <div className="px-4 pb-24 lg:hidden">
            <Footer />
          </div>
        </main>
      </div>

      {/* Telefono: invito all'installazione, sopra la barra in basso */}
      {showInvite && (
        <InstallInvite
          context={context}
          onInstall={() => {
            void install()
          }}
          onDismiss={dismiss}
        />
      )}

      {/* Telefono: barra in basso */}
      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border/60 bg-background/90 safe-x pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {SECTIONS.map((section) => (
          <Link
            key={section.key}
            to={section.path}
            aria-current={isActive(section.path) ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] focus-visible:bg-muted focus-visible:outline-none',
              isActive(section.path) ? 'font-medium text-foreground' : 'text-muted-foreground',
            )}
          >
            <section.icon className="size-5" aria-hidden="true" />
            {t(`nav.${section.key}`)}
          </Link>
        ))}
      </nav>
    </div>
  )
}

function Footer() {
  const { t } = useTranslation()
  return (
    <footer className="space-y-2 text-xs leading-relaxed text-muted-foreground">
      <p>{t('footer.disclaimer')}</p>
      <Link
        to={PRIVACY_PATH}
        className="underline underline-offset-2 hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        {t('footer.privacy')}
      </Link>
    </footer>
  )
}

/**
 * "Accedi", solo per chi non ha fatto l'accesso e fuori dalle pagine di account: dopo l'accesso
 * si torna alla pagina in cui si era (il catalogo resta consultabile anche senza account).
 */
function LoginLink({ className }: { className?: string }) {
  const { t } = useTranslation()
  const session = useSession()
  const { pathname, search } = useLocation()
  if (session.status !== 'signedOut' || ACCOUNT_PATHS.includes(pathname)) return null
  return (
    <Link
      to={loginPath(pathname + search)}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
        className,
      )}
    >
      <LogIn className="size-4" aria-hidden="true" />
      {t('nav.login')}
    </Link>
  )
}

/** Senza connessione: il catalogo e le immagini già salvate restano consultabili. */
function OfflineBadge({ className }: { className?: string }) {
  const { t } = useTranslation()
  const online = useOnline()
  if (online) return null
  return (
    <p
      role="status"
      title={t('offline.badgeHint')}
      className={cn(
        'inline-flex w-fit items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground',
        className,
      )}
    >
      <WifiOff className="size-3.5" aria-hidden="true" />
      {t('offline.badge')}
    </p>
  )
}
