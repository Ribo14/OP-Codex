import { BookmarkPlus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { useSession } from '@/account/session'
import { useBanList } from '@/catalog/ban-list'
import { useCatalog } from '@/catalog/local-catalog'
import { CardThumb } from './CardThumb'
import { DECK_SIZE, deckRows, shownPrinting, type DeckRow } from './deck'
import { formatDeckList } from './deck-list'
import { checkDeck, deckStats } from './deck-rules'
import { DeckListActions } from './DeckListActions'
import { createDeckWithCards, loadSharedDeck, type SharedDeck } from './decks-api'
import { DeckStatsPanel } from './DeckStats'
import { DeckWarningsPanel } from './DeckWarnings'
import { deckPath } from './paths'

// Pagina pubblica di uno Share Link (RIB-26), /m/:token: il Deck in sola lettura, anche senza
// account. Chi ha l'account può salvarne una copia tra i propri Mazzi.

type State =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | {
      status: 'ready'
      deck: SharedDeck
    }

export function SharedDeckPage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    let current = true
    void loadSharedDeck(token).then(
      (deck) => {
        if (current) setState(deck ? { status: 'ready', deck } : { status: 'missing' })
      },
      () => {
        if (current) setState({ status: 'error' })
      },
    )
    return () => {
      current = false
    }
  }, [token])

  if (state.status === 'loading') {
    return <p className="text-muted-foreground">{t('decks.loadingDeck')}</p>
  }
  if (state.status !== 'ready') {
    return (
      <div className="mx-auto max-w-md space-y-3 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">{t('decks.shared.title')}</h1>
        <p role="alert">
          {t(state.status === 'missing' ? 'decks.shared.missing' : 'decks.loadFailed')}
        </p>
        <Link to="/" className="text-sm underline underline-offset-2">
          {t('collection.toCatalog')}
        </Link>
      </div>
    )
  }
  return <SharedDeckView deck={state.deck} />
}

function SharedDeckView({ deck }: { deck: SharedDeck }) {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const banList = useBanList()
  const session = useSession()
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  const byCode = useMemo(
    () => new Map((catalog?.cards ?? []).map((card) => [card.cardCode, card])),
    [catalog],
  )
  const warnings = useMemo(
    () =>
      checkDeck({ leaderCode: deck.leaderCode, cards: deck.cards }, byCode, {
        format: deck.format,
        banList,
        today: new Date(),
      }),
    [deck, byCode, banList],
  )
  const stats = useMemo(() => deckStats(deck.cards, byCode), [deck, byCode])

  if (!catalog) return <p className="text-muted-foreground">{t('catalog.loading')}</p>

  const leader = byCode.get(deck.leaderCode)
  const count = deck.cards.reduce((sum, c) => sum + c.quantity, 0)
  const canSave = session.status === 'signedIn' && !session.needsCode

  const save = () => {
    setSaving(true)
    setFailed(false)
    void createDeckWithCards(deck.name, deck.leaderCode, deck.cards).then(
      (id) => {
        void navigate(deckPath(id))
      },
      () => {
        setSaving(false)
        setFailed(true)
      },
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {t('decks.shared.title')}
      </p>
      <div className="flex gap-4">
        <CardThumb
          printing={leader ? shownPrinting(leader, deck.leaderPrintId) : undefined}
          name={leader?.name ?? deck.leaderCode}
          className="w-20 shrink-0 rounded-lg sm:w-24"
        />
        <div className="min-w-0 flex-1 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{deck.name}</h1>
          {deck.username && (
            <p className="text-sm text-muted-foreground">
              {t('decks.shared.by', { username: deck.username })}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {t('decks.leader')}:{' '}
            <span className="text-foreground">{leader?.name ?? deck.leaderCode}</span> ·{' '}
            {t(`decks.formats.${deck.format}`)}
          </p>
          <p className="text-sm font-medium tabular-nums">
            {t('decks.count', { count, size: DECK_SIZE })}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <DeckListActions
              name={deck.name}
              text={formatDeckList(deck.leaderCode, deck.cards, byCode)}
            />
            {canSave && (
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50"
              >
                <BookmarkPlus className="size-3.5" aria-hidden="true" />
                {t('decks.shared.save')}
              </button>
            )}
          </div>
          {failed && (
            <p role="alert" className="text-xs text-destructive">
              {t('decks.saveFailed')}
            </p>
          )}
        </div>
      </div>

      <DeckWarningsPanel warnings={warnings} catalog={byCode} />
      <DeckStatsPanel stats={stats} />
      <ReadOnlyCards rows={deckRows(deck.cards, catalog.cards)} />
    </div>
  )
}

function ReadOnlyCards({ rows }: { rows: DeckRow[] }) {
  const { t } = useTranslation()
  const groups = new Map<string, DeckRow[]>()
  for (const row of rows)
    groups.set(row.card.category, [...(groups.get(row.card.category) ?? []), row])
  return (
    <div className="space-y-5">
      {[...groups].map(([category, list]) => (
        <section key={category}>
          <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {category} · {list.reduce((sum, r) => sum + r.quantity, 0)}
          </h2>
          <ul className="divide-y">
            {list.map((row) => (
              <li key={row.card.cardCode} className="flex items-center gap-3 py-2">
                <CardThumb printing={row.printing} name={row.card.name} className="w-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.card.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {row.card.cardCode}
                    {row.card.cost !== null && ` · ${t('decks.cost', { cost: row.card.cost })}`}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">×{row.quantity}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
