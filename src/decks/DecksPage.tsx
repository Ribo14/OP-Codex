import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { field } from '@/account/form-data'
import { RequireAccount } from '@/account/ProfilePage'
import { useSession } from '@/account/session'
import { SignedOutInvite } from '@/account/SignedOutInvite'
import type { CatalogCard } from '@/catalog/catalog-data'
import { useCatalog } from '@/catalog/local-catalog'
import { CardThumb } from './CardThumb'
import { DECK_SIZE, shownPrinting, type DeckSummary } from './deck'
import { checkDeck, EMPTY_BAN_LIST } from './deck-rules'
import { deleteDeck, duplicateDeck, listDecks, renameDeck, type DeckDetail } from './decks-api'
import { ValidityBadge } from './DeckWarnings'
import { deckPath, DECKS_PATH, NEW_DECK_PATH } from './paths'

// Pagina Mazzi (RIB-21): i miei Deck con l'immagine del Leader; rinomina, duplica, elimina.

export function DecksPage() {
  const { t } = useTranslation()
  const session = useSession()
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{t('nav.decks')}</h1>
      {session.status === 'signedOut' ? (
        <SignedOutInvite text={t('decks.signedOut')} returnTo={DECKS_PATH} />
      ) : (
        <RequireAccount>{() => <DeckList />}</RequireAccount>
      )}
    </div>
  )
}

type ListState =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; decks: DeckDetail[] }

function DeckList() {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const [state, setState] = useState<ListState>({ status: 'loading' })

  const read = useCallback(
    () =>
      listDecks().then(
        (decks): ListState => ({ status: 'ready', decks }),
        (): ListState => ({ status: 'error' }),
      ),
    [],
  )

  useEffect(() => {
    let current = true
    void read().then((next) => {
      if (current) setState(next)
    })
    return () => {
      current = false
    }
  }, [read])

  const reload = () => {
    void read().then(setState)
  }

  const byCode = useMemo(
    () => new Map((catalog?.cards ?? []).map((card) => [card.cardCode, card])),
    [catalog],
  )
  /** Avvisi di ogni Deck (null finché il catalogo non c'è). La Ban List arriverà con RIB-29. */
  const warningsOf = (detail: DeckDetail) =>
    catalog
      ? checkDeck({ leaderCode: detail.deck.leaderCode, cards: detail.cards }, byCode, {
          format: detail.deck.format,
          banList: EMPTY_BAN_LIST,
          today: new Date(),
        }).length
      : null

  return (
    <div className="space-y-5">
      <Link
        to={NEW_DECK_PATH}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background"
      >
        <Plus className="size-4" aria-hidden="true" />
        {t('decks.new')}
      </Link>
      {state.status === 'loading' && <p className="text-muted-foreground">{t('decks.loading')}</p>}
      {state.status === 'error' && (
        <div className="space-y-3">
          <p role="alert" className="text-destructive">
            {t('decks.loadFailed')}
          </p>
          <button
            type="button"
            onClick={reload}
            className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium hover:bg-muted"
          >
            {t('collection.retry')}
          </button>
        </div>
      )}
      {state.status === 'ready' &&
        (state.decks.length === 0 ? (
          <p className="text-muted-foreground">{t('decks.empty')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {state.decks.map((detail) => (
              <DeckItem
                key={detail.deck.id}
                deck={detail.deck}
                leader={byCode.get(detail.deck.leaderCode)}
                warnings={warningsOf(detail)}
                onChanged={reload}
              />
            ))}
          </ul>
        ))}
    </div>
  )
}

const ACTION =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50'

function DeckItem({
  deck,
  leader,
  warnings,
  onChanged,
}: {
  deck: DeckSummary
  leader: CatalogCard | undefined
  /** Numero di Deck Warning (RIB-23); null finché non si può calcolare. */
  warnings: number | null
  onChanged: () => void
}) {
  const { t, i18n } = useTranslation()
  const [mode, setMode] = useState<'view' | 'rename' | 'delete'>('view')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const run = (action: () => Promise<unknown>) => {
    setBusy(true)
    setFailed(false)
    void action().then(
      () => {
        setBusy(false)
        setMode('view')
        onChanged()
      },
      () => {
        setBusy(false)
        setFailed(true)
      },
    )
  }

  const rename = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = field(new FormData(event.currentTarget), 'name').trim()
    if (!name) return
    run(() => renameDeck(deck.id, name))
  }

  const updated = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' }).format(
    new Date(deck.updatedAt),
  )
  const leaderName = leader?.name ?? deck.leaderCode

  return (
    <li className="space-y-3 rounded-2xl border p-3">
      <Link to={deckPath(deck.id)} className="flex gap-3 rounded-xl focus-visible:outline-none">
        <CardThumb
          printing={leader ? shownPrinting(leader, deck.leaderPrintId) : undefined}
          name={leaderName}
          className="w-16 shrink-0"
        />
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium">{deck.name}</p>
          <p className="truncate text-sm text-muted-foreground">{leaderName}</p>
          <p className="text-xs text-muted-foreground tabular-nums">
            {t('decks.count', { count: deck.cardCount, size: DECK_SIZE })} · {updated}
          </p>
          {warnings !== null && <ValidityBadge warnings={warnings} />}
        </div>
      </Link>

      {mode === 'rename' && (
        <form onSubmit={rename} className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t('decks.name')}</span>
            <input
              name="name"
              defaultValue={deck.name}
              maxLength={60}
              required
              // Appena aperto il campo, si scrive.
              autoFocus
              className="h-9 w-full rounded-full border bg-background px-3 text-sm"
            />
          </label>
          <button type="submit" disabled={busy} className={ACTION}>
            {t('decks.save')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('view')
            }}
            className={ACTION}
          >
            {t('decks.cancel')}
          </button>
        </form>
      )}

      {mode === 'delete' && (
        <div role="alertdialog" aria-label={t('decks.deleteTitle')} className="space-y-2">
          <p className="text-sm">{t('decks.deleteConfirm', { name: deck.name })}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                run(() => deleteDeck(deck.id))
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-destructive px-3 text-xs font-medium text-white disabled:opacity-50"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              {t('decks.delete')}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('view')
              }}
              className={ACTION}
            >
              {t('decks.cancel')}
            </button>
          </div>
        </div>
      )}

      {mode === 'view' && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setMode('rename')
            }}
            className={ACTION}
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            {t('decks.rename')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              run(() => duplicateDeck(deck.id))
            }}
            className={ACTION}
          >
            <Copy className="size-3.5" aria-hidden="true" />
            {t('decks.duplicate')}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('delete')
            }}
            className={ACTION}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t('decks.delete')}
          </button>
        </div>
      )}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t('decks.saveFailed')}
        </p>
      )}
    </li>
  )
}
