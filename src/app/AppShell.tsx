import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import { Download, LogIn, Settings, User, WifiOff } from 'lucide-react'
import { ACCOUNT_PATHS, LOGIN_PATH, PROFILE_PATH } from '@/account/paths'
import { loginPath } from '@/account/return-path'
import { useSession } from '@/account/session'
import { UsernameGate } from '@/account/UsernameGate'
import { usePendingRequests } from '@/friends/use-pending-requests'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'
import { useInstall } from './install'
import { InstallInvite } from './InstallInvite'
import { navSections, phoneSections, PRIVACY_PATH, SETTINGS_PATH, type Section } from './sections'
import { ThemeCycleButton, ThemeSegmented } from './ThemeToggle'

// Struttura dell'app (docs/design.md): barra in basso su telefono, barra laterale da `lg`.

export function AppShell() {
  const { t } = useTranslation()
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  // Il dettaglio di una Card (/carta/...) fa parte del Catalogo: aprirlo non cambia sezione.
  const inCardDetail = pathname.startsWith('/carta/')
  const sectionPath = inCardDetail ? '/' : pathname
  // Anche le sottopagine (un mazzo, il profilo di un amico) tengono attiva la loro sezione.
  const isActive = (path: string) =>
    path === '/' ? sectionPath === '/' : sectionPath === path || sectionPath.startsWith(`${path}/`)
  const { context, showInvite, canInstallFromMenu, install, dismiss } = useInstall()
  // Senza accesso le voci che richiedono l'account non compaiono. Mentre la sessione si legge
  // (pochi istanti) si mostra la barra completa, per non farla saltare a chi è già dentro.
  const signedOut = useSession().status === 'signedOut'
  const sections = navSections(!signedOut)
  const phone = phoneSections(!signedOut)
  // Friend Request ricevute (RIB-71): numero accanto ad Amici, pallino sul Profilo.
  const pending = usePendingRequests()
  const pendingLabel = pending > 0 ? t('friends.badge', { count: pending }) : null

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
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar bg-[image:var(--waves)] bg-[length:40px_20px] text-sidebar-foreground lg:flex">
        <Link
          to="/"
          viewTransition
          className="group mx-auto mt-6 mb-2 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <AppLogo className="size-28 transition-transform duration-500 ease-[var(--ease-spring)] group-hover:scale-105 group-hover:-rotate-6" />
        </Link>
        <p className="mb-5 text-center font-heading text-lg font-bold tracking-tight">
          {t('app.name')}
        </p>
        <OfflineBadge className="mx-6 mb-4" />
        <nav aria-label={t('nav.label')} className="flex flex-col gap-1 px-3">
          {sections.map((section) => (
            <Link
              key={section.key}
              to={section.path}
              viewTransition
              aria-current={isActive(section.path) ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-3 rounded-full px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                isActive(section.path)
                  ? 'font-semibold text-gold-foreground'
                  : 'text-muted-foreground hover:bg-sidebar-accent hover:text-foreground',
              )}
            >
              {/* La pillola d'oro della voce attiva scivola da una voce all'altra (index.css). */}
              {isActive(section.path) && (
                <span
                  aria-hidden="true"
                  className="nav-active absolute inset-0 -z-0 rounded-full bg-gold shadow-[0_6px_16px_-6px_var(--gold)]"
                />
              )}
              <section.icon className="relative size-[18px]" aria-hidden="true" />
              <span className="relative">{t(`nav.${section.key}`)}</span>
              {section.key === 'friends' && pendingLabel && (
                <span className="relative ml-auto rounded-full bg-destructive px-2 py-0.5 text-[11px] leading-none font-semibold text-white tabular-nums">
                  <span aria-hidden="true">{pending}</span>
                  <span className="sr-only">{pendingLabel}</span>
                </span>
              )}
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
        {/* Telefono: intestazione (box-content: 3.5rem più l'eventuale area sicura in alto) */}
        <header className="box-content flex h-14 shrink-0 items-center gap-2 border-b border-border/60 bg-sidebar bg-[image:var(--waves)] bg-[length:40px_20px] px-4 safe-top lg:hidden">
          <Link
            to="/"
            viewTransition
            className="-ml-1 flex items-center gap-2 rounded-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <AppLogo className="size-12" />
            <span className="font-heading text-lg font-bold tracking-tight">{t('app.name')}</span>
          </Link>
          <div className="-mr-2 ml-auto flex items-center gap-1">
            <OfflineBadge className="mr-1" />
            <ThemeCycleButton />
            {/* Il Profilo sta qui e non nella barra in basso, dove c'è lo Scanner (RIB-69).
                Senza accesso "Accedi" sta nella barra in basso. */}
            {!signedOut && (
              <Link
                to={PROFILE_PATH}
                aria-label={
                  pendingLabel ? `${t('nav.profile')} · ${pendingLabel}` : t('nav.profile')
                }
                title={t('nav.profile')}
                aria-current={pathname === PROFILE_PATH ? 'page' : undefined}
                className="relative inline-flex size-10 items-center justify-center rounded-full text-foreground/80 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none aria-[current=page]:bg-muted"
              >
                <User className="size-5" aria-hidden="true" />
                {pendingLabel && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-destructive ring-2 ring-background"
                  />
                )}
              </Link>
            )}
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
          {/* view-transition-name: main → al cambio di sezione solo il contenuto si anima. */}
          <div className="mx-auto w-full max-w-[1600px] px-4 pt-5 pb-8 [view-transition-name:main] lg:px-8 lg:pt-8">
            <UsernameGate />
            <Outlet />
          </div>
          {/* Telefono: avviso e privacy in fondo a ogni pagina, sopra la barra */}
          <div className="px-4 pb-32 lg:hidden">
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

      {/* Telefono: barra in basso, una pillola di vetro che galleggia sopra il contenuto */}
      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 mx-auto flex max-w-lg rounded-full border border-border bg-card/80 px-1 shadow-[0_12px_32px_-12px_hsl(var(--shadow-color)/0.5)] backdrop-blur-xl backdrop-saturate-150 lg:hidden"
      >
        {phone.map((section) =>
          section.key === 'scanner' ? (
            <ScannerButton key={section.key} section={section} active={isActive(section.path)} />
          ) : (
            <Link
              key={section.key}
              to={section.path}
              viewTransition
              aria-current={isActive(section.path) ? 'page' : undefined}
              className={cn(BOTTOM_ITEM, isActive(section.path) ? BOTTOM_ACTIVE : BOTTOM_IDLE)}
            >
              <span className="relative grid h-7 w-12 place-items-center">
                {/* La pillola della voce attiva scivola da una voce all'altra (index.css). */}
                {isActive(section.path) && (
                  <span
                    aria-hidden="true"
                    className="nav-active absolute inset-0 rounded-full bg-gold/25"
                  />
                )}
                <section.icon className="relative size-5" aria-hidden="true" />
              </span>
              {t(`nav.${section.key}`)}
            </Link>
          ),
        )}
        {signedOut && <BottomLoginLink />}
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

/** Il logo (medaglione da brand/logo.png, `npm run icons`); il nome dell'app è il testo alternativo. */
function AppLogo({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <img
      src="/logo.png"
      alt={t('app.name')}
      width={256}
      height={256}
      decoding="async"
      className={cn('block drop-shadow-sm select-none', className)}
      draggable={false}
    />
  )
}

const BOTTOM_ITEM =
  'flex min-h-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] focus-visible:bg-muted focus-visible:outline-none'
const BOTTOM_ACTIVE = 'font-semibold text-foreground'
const BOTTOM_IDLE = 'text-muted-foreground'

/**
 * Telefono: lo Scanner è la voce centrale della barra, un pulsante tondo che sporge sopra le
 * altre (RIB-69): prezzo e dettagli di una carta a un tocco.
 */
function ScannerButton({ section, active }: { section: Section; active: boolean }) {
  const { t } = useTranslation()
  return (
    <Link
      to={section.path}
      viewTransition
      aria-current={active ? 'page' : undefined}
      className={cn(BOTTOM_ITEM, 'group relative', active ? BOTTOM_ACTIVE : BOTTOM_IDLE)}
    >
      {/* Al posto dell'icona uno spazio uguale, così l'etichetta resta in riga con le altre. */}
      <span className="h-7" aria-hidden="true" />
      <span className="absolute -top-6 left-1/2 grid size-14 -translate-x-1/2 place-items-center rounded-full bg-gold text-gold-foreground shadow-[0_8px_20px_-6px_var(--gold)] ring-4 ring-background transition-transform duration-300 ease-[var(--ease-spring)] group-active:scale-90">
        <section.icon className="size-6" aria-hidden="true" />
      </span>
      {t(`nav.${section.key}`)}
    </Link>
  )
}

/**
 * Telefono, senza accesso: "Accedi" è l'ultima voce della barra, al posto del Profilo. Dopo
 * l'accesso si torna alla pagina in cui si era; nelle pagine di account è la voce attiva.
 */
function BottomLoginLink() {
  const { t } = useTranslation()
  const { pathname, search } = useLocation()
  const inAccountPages = ACCOUNT_PATHS.includes(pathname)
  return (
    <Link
      to={inAccountPages ? LOGIN_PATH : loginPath(pathname + search)}
      aria-current={inAccountPages ? 'page' : undefined}
      className={cn(BOTTOM_ITEM, inAccountPages ? BOTTOM_ACTIVE : BOTTOM_IDLE)}
    >
      <span className="grid h-7 w-12 place-items-center">
        <LogIn className="size-5" aria-hidden="true" />
      </span>
      {t('nav.login')}
    </Link>
  )
}

/**
 * Desktop: "Accedi" in fondo alla barra laterale, solo per chi non ha fatto l'accesso e fuori
 * dalle pagine di account; dopo l'accesso si torna alla pagina in cui si era.
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
        'inline-flex items-center justify-center gap-2 rounded-full bg-gold text-sm font-semibold text-gold-foreground shadow-[0_6px_16px_-6px_var(--gold)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
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
