import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { useDeferredValue, useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { RequireAccount } from '@/account/ProfilePage'
import { useSession } from '@/account/session'
import { SignedOutInvite } from '@/account/SignedOutInvite'
import { useCatalog } from '@/catalog/local-catalog'
import { useOnline } from '@/lib/use-online'
import { CardThumb } from './CardThumb'
import { DECK_SIZE, shownPrinting } from './deck'
import { parseDeckList } from './deck-list'
import { createDeckWithCards } from './decks-api'
import { deckPath, DECKS_PATH, IMPORT_DECK_PATH } from './paths'

// Importa un Deck da una lista "4xOP01-016" (RIB-24): si incolla, si vede l'anteprima con le
// righe non riconosciute, si conferma. Le righe sbagliate non bloccano l'import delle altre.

export function ImportDeckPage() {
  const { t } = useTranslation()
  const session = useSession()
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link
        to={DECKS_PATH}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('nav.decks')}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
        {t('decks.import.title')}
      </h1>
      {session.status === 'signedOut' ? (
        <SignedOutInvite text={t('decks.signedOut')} returnTo={IMPORT_DECK_PATH} />
      ) : (
        <RequireAccount>{() => <Importer />}</RequireAccount>
      )}
    </div>
  )
}

function Importer() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const online = useOnline()
  const { catalog } = useCatalog()
  const textId = useId()
  const [text, setText] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const deferred = useDeferredValue(text)

  const byCode = useMemo(
    () => new Map((catalog?.cards ?? []).map((card) => [card.cardCode, card])),
    [catalog],
  )
  const parsed = useMemo(() => parseDeckList(deferred, byCode), [deferred, byCode])
  const leader = parsed.leaderCode ? byCode.get(parsed.leaderCode) : undefined
  const count = parsed.cards.reduce((sum, c) => sum + c.quantity, 0)

  if (!catalog) return <p className="text-muted-foreground">{t('catalog.loading')}</p>

  const create = () => {
    if (!leader) return
    setBusy(true)
    setFailed(false)
    const deckName = (name.trim() || leader.name).slice(0, 60)
    void createDeckWithCards(deckName, leader.cardCode, parsed.cards).then(
      (id) => {
        void navigate(deckPath(id), { replace: true })
      },
      () => {
        setBusy(false)
        setFailed(true)
      },
    )
  }

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <label htmlFor={textId} className="block text-sm font-medium">
          {t('decks.import.label')}
        </label>
        <textarea
          id={textId}
          value={text}
          onChange={(e) => {
            setText(e.target.value)
          }}
          rows={10}
          spellCheck={false}
          autoCapitalize="none"
          placeholder={t('decks.import.placeholder')}
          className="w-full rounded-xl border bg-background px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">{t('decks.import.hint')}</p>
      </div>

      {deferred.trim() && (
        <section aria-labelledby="anteprima" className="space-y-3 rounded-2xl border p-4">
          <h2 id="anteprima" className="text-sm font-medium">
            {t('decks.import.preview')}
          </h2>
          <div className="flex items-center gap-3">
            <CardThumb
              printing={leader ? shownPrinting(leader, null) : undefined}
              name={leader?.name ?? '?'}
              className="w-14 shrink-0"
            />
            <div className="text-sm">
              <p className="font-medium">
                {leader
                  ? t('decks.import.leader', { name: leader.name, code: leader.cardCode })
                  : t('decks.import.noLeader')}
              </p>
              <p className="text-muted-foreground tabular-nums" aria-live="polite">
                {t('decks.count', { count, size: DECK_SIZE })}
              </p>
            </div>
          </div>
          {parsed.errors.length > 0 && (
            <div className="space-y-1 rounded-xl bg-amber-500/10 p-3 text-sm">
              <p className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
                <TriangleAlert className="size-4" aria-hidden="true" />
                {t('decks.import.ignored', { count: parsed.errors.length })}
              </p>
              <ul className="space-y-0.5 text-xs">
                {parsed.errors.map((e) => (
                  <li key={e.line}>
                    {t('decks.import.lineError', {
                      line: e.line,
                      text: e.text,
                      reason: t(`decks.import.problem.${e.problem}`),
                    })}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <label className="block space-y-1 text-sm">
            <span className="font-medium">{t('decks.name')}</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
              }}
              maxLength={60}
              placeholder={leader?.name ?? ''}
              className="h-10 w-full rounded-full border bg-background px-3 text-base"
            />
          </label>
          {failed && (
            <p role="alert" className="text-sm text-destructive">
              {t('decks.saveFailed')}
            </p>
          )}
          <button
            type="button"
            disabled={!leader || busy || !online}
            onClick={create}
            className="inline-flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background disabled:opacity-50"
          >
            {parsed.errors.length > 0
              ? t('decks.import.createAnyway', { count: parsed.errors.length })
              : t('decks.import.create')}
          </button>
          {!online && <p className="text-sm text-muted-foreground">{t('decks.offline')}</p>}
        </section>
      )}
    </div>
  )
}
