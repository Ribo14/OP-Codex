import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { cn } from '@/lib/utils'
import { PRIVACY_PATH, SECTIONS } from './sections'
import { ThemeCycleButton, ThemeSegmented } from './ThemeToggle'

// Struttura dell'app (docs/design.md): barra in basso su telefono, barra laterale da `lg`.

export function AppShell() {
  const { t } = useTranslation()
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  // A ogni cambio di pagina si riparte dall'alto.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <div className="flex h-svh bg-background text-foreground">
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
        <nav aria-label={t('nav.label')} className="flex flex-col gap-1 px-3">
          {SECTIONS.map((section) => (
            <NavLink
              key={section.key}
              to={section.path}
              end={section.path === '/'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  isActive
                    ? 'bg-foreground font-medium text-background'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )
              }
            >
              <section.icon className="size-[18px]" aria-hidden="true" />
              {t(`nav.${section.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto space-y-4 px-6 py-5">
          <ThemeSegmented />
          <Footer />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Telefono: intestazione */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 px-4 lg:hidden">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            {t('app.name')}
          </Link>
          <ThemeCycleButton className="ml-auto" />
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

      {/* Telefono: barra in basso */}
      <nav
        aria-label={t('nav.label')}
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {SECTIONS.map((section) => (
          <NavLink
            key={section.key}
            to={section.path}
            end={section.path === '/'}
            className={({ isActive }) =>
              cn(
                'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] focus-visible:bg-muted focus-visible:outline-none',
                isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
              )
            }
          >
            <section.icon className="size-5" aria-hidden="true" />
            {t(`nav.${section.key}`)}
          </NavLink>
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
