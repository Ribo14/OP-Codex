import { LogIn, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router'
import { loginPath } from '@/account/return-path'
import { useSession } from '@/account/session'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'
import { copiesOf, DEFAULT_LANGUAGE, LANGUAGES, quantityOf, type Language } from './collection'
import { useCollection } from './collection-store'

// Nel dettaglio Card (RIB-20): quante copie di questa Printing possiedo, per lingua, con +/−.

export function CollectionControls({ printId }: { printId: string }) {
  const { t } = useTranslation()
  const session = useSession()
  const { pathname, search } = useLocation()

  if (session.status === 'loading') return null
  if (session.status === 'signedOut') {
    return (
      <Link
        to={loginPath(pathname + search)}
        className="flex items-center gap-3 rounded-2xl border p-4 text-sm hover:bg-muted"
      >
        <LogIn className="size-4 shrink-0" aria-hidden="true" />
        {t('collection.loginToTrack')}
      </Link>
    )
  }
  // Chi deve ancora dare il codice della verifica viene portato a darlo dalla shell.
  if (session.needsCode) return null
  return <Controls userId={session.user.id} printId={printId} />
}

function Controls({ userId, printId }: { userId: string; printId: string }) {
  const { t } = useTranslation()
  const online = useOnline()
  const { state, change } = useCollection(userId)
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE)
  const [failed, setFailed] = useState(false)

  const entries = state.status === 'ready' ? state.entries : []
  const copies = copiesOf(entries, printId)
  const current = quantityOf(entries, printId, language)
  const disabled = !online || state.status !== 'ready'

  const tap = (delta: number) => {
    setFailed(false)
    void change(printId, language, delta).then((saved) => {
      if (!saved) setFailed(true)
    })
  }

  return (
    <section aria-labelledby="collezione-titolo" className="space-y-3 rounded-2xl border p-4">
      <div className="flex items-baseline gap-2">
        <h3 id="collezione-titolo" className="text-sm font-medium">
          {t('collection.inYours')}
        </h3>
        <span className="ml-auto text-sm text-muted-foreground" aria-live="polite">
          {state.status === 'ready' && t('collection.printingTotal', { count: copies.total })}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label={t('collection.language')}
        className="flex flex-wrap gap-1.5"
      >
        {LANGUAGES.map((lang) => {
          const owned = quantityOf(entries, printId, lang)
          return (
            <button
              key={lang}
              type="button"
              role="radio"
              aria-checked={lang === language}
              aria-label={t('collection.languageOption', {
                language: t(`collection.languages.${lang}`),
                count: owned,
              })}
              onClick={() => {
                setLanguage(lang)
              }}
              className={cn(
                'inline-flex h-8 items-center gap-1 rounded-full border px-3 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                lang === language
                  ? 'border-foreground bg-foreground text-background'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {lang}
              {owned > 0 && <span className="tabular-nums">·{owned}</span>}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4">
        <button
          type="button"
          disabled={disabled || current === 0}
          onClick={() => {
            tap(-1)
          }}
          aria-label={t('collection.remove', { language })}
          className="inline-flex size-11 items-center justify-center rounded-full border hover:bg-muted disabled:opacity-40"
        >
          <Minus className="size-5" aria-hidden="true" />
        </button>
        <output
          aria-label={t('collection.copiesIn', { language })}
          className="min-w-10 text-center text-2xl font-semibold tabular-nums"
        >
          {state.status === 'ready' ? current : '–'}
        </output>
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            tap(1)
          }}
          aria-label={t('collection.add', { language })}
          className="inline-flex size-11 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>
      </div>

      {!online && <p className="text-xs text-muted-foreground">{t('collection.offline')}</p>}
      {state.status === 'error' && (
        <p role="alert" className="text-xs text-destructive">
          {t('collection.loadFailed')}
        </p>
      )}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t('collection.saveFailed')}
        </p>
      )}
    </section>
  )
}
