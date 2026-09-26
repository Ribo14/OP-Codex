import {
  ArrowLeft,
  Minus,
  Pencil,
  Plus,
  ScanSearch,
  Search,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { field } from '@/account/form-data'
import { RequireAccount } from '@/account/ProfilePage'
import { useSession } from '@/account/session'
import { SignedOutInvite } from '@/account/SignedOutInvite'
import { CardDetail } from '@/catalog/CardDetail'
import type { Catalog, CatalogCard, CatalogPrinting } from '@/catalog/catalog-data'
import { catalogFacets, countActiveFilters, relatedFilters } from '@/catalog/filters'
import { FiltersPanel } from '@/catalog/FiltersPanel'
import { useCatalog } from '@/catalog/local-catalog'
import { useCatalogFilters } from '@/catalog/use-catalog-filters'
import { useCollection, useOwnership } from '@/collection/collection-store'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'
import { CardThumb } from './CardThumb'
import {
  DECK_SIZE,
  deckCandidates,
  deckRows,
  quantityInDeck,
  shownPrinting,
  type DeckCard,
  type DeckRow,
  type DeckSummary,
} from './deck'
import { useBanList } from '@/catalog/ban-list'
import { formatDeckList } from './deck-list'
import { checkDeck, DECK_FORMATS, deckStats, flaggedCards } from './deck-rules'
import { DeckListActions } from './DeckListActions'
import { useDeck, type DeckStore } from './deck-store'
import { DeckStatsPanel } from './DeckStats'
import { DeckWarningsPanel } from './DeckWarnings'
import { deckOwnership, type MissingRow } from './missing-cards'
import { MissingCardsPanel, OwnedBadge } from './MissingCardsPanel'
import { deckLeaderPath, DECKS_PATH } from './paths'
import { ShareDeckSection } from './ShareDeckSection'

// Editor di un Deck (RIB-21). Ogni modifica si salva da sola. Due schede, "Mazzo" e "Aggiungi
// carte", che non perdono ricerca e filtri. Anche su desktop le schede non sono affiancate
// (RIB-49): la lista delle carte da aggiungere accanto al mazzo confondeva; lo spazio va alle
// carte del mazzo, in griglia. Toccando una carta se ne apre il dettaglio (RIB-47).

const PAGE = 40
const TABS = ['deck', 'add'] as const

/** Stato della cronologia col dettaglio aperto: "indietro" (anche su Android) lo chiude. */
interface OpenCardState {
  deckCard: string
  printId: string
}

function openCardState(state: unknown): OpenCardState | null {
  const s = state as Partial<OpenCardState> | null
  return typeof s?.deckCard === 'string' && typeof s.printId === 'string'
    ? { deckCard: s.deckCard, printId: s.printId }
    : null
}

export function DeckEditorPage() {
  const { t } = useTranslation()
  const session = useSession()
  const { deckId = '' } = useParams()
  return session.status === 'signedOut' ? (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('nav.decks')}</h1>
      <SignedOutInvite text={t('decks.signedOut')} returnTo={DECKS_PATH} />
    </div>
  ) : (
    <RequireAccount>{() => <Editor deckId={deckId} />}</RequireAccount>
  )
}

function Editor({ deckId }: { deckId: string }) {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const { state, store } = useDeck(deckId)
  const [tab, setTab] = useState<'deck' | 'add'>('deck')
  const [failed, setFailed] = useState(false)
  const online = useOnline()
  const { update } = useCatalogFilters()
  const byCode = useMemo(
    () => new Map((catalog?.cards ?? []).map((card) => [card.cardCode, card])),
    [catalog],
  )
  const ready = state.status === 'ready' ? state : null
  const banList = useBanList()
  // Deck Warning e statistiche (RIB-23), ricalcolati a ogni modifica: sono in memoria, istantanei.
  const warnings = useMemo(
    () =>
      ready
        ? checkDeck({ leaderCode: ready.deck.leaderCode, cards: ready.cards }, byCode, {
            format: ready.deck.format,
            banList,
            today: new Date(),
          })
        : [],
    [ready, byCode, banList],
  )
  const stats = useMemo(() => deckStats(ready?.cards ?? [], byCode), [ready, byCode])
  // Carte mancanti rispetto alla Collection (RIB-25).
  const session = useSession()
  const { state: collection } = useCollection(
    session.status === 'signedIn' ? session.user.id : null,
  )
  const collectionEntries = collection.status === 'ready' ? collection.entries : null
  const ownership = useMemo(
    () =>
      ready && collectionEntries
        ? deckOwnership(ready.deck.leaderCode, ready.cards, collectionEntries)
        : [],
    [ready, collectionEntries],
  )
  const ownershipByCode = useMemo(
    () => new Map(ownership.map((row) => [row.cardCode, row])),
    [ownership],
  )
  // Dettaglio di una carta (RIB-47): una voce nella cronologia sulla stessa pagina, così il mazzo
  // resta com'è sotto e "indietro" chiude il dettaglio.
  const location = useLocation()
  const navigate = useNavigate()
  const opened = openCardState(location.state)
  const here = location.pathname + location.search
  const openCard = (card: CatalogCard, printId: string | null) => {
    const state: OpenCardState = {
      deckCard: card.cardCode,
      printId: printId ?? card.printings[0]?.printId ?? card.cardCode,
    }
    void navigate(here, { state })
  }
  const tablist = useRef<HTMLDivElement>(null)

  if (state.status === 'loading' || !catalog) {
    return <p className="text-muted-foreground">{t('decks.loadingDeck')}</p>
  }
  if (state.status === 'missing' || state.status === 'error') {
    return (
      <div className="space-y-3">
        <p role="alert">{t(state.status === 'missing' ? 'decks.notFound' : 'decks.loadFailed')}</p>
        <Link to={DECKS_PATH} className="text-sm underline underline-offset-2">
          {t('decks.backToList')}
        </Link>
      </div>
    )
  }

  const { deck, cards } = state
  // Ogni modifica: se il salvataggio fallisce, compare l'avviso.
  const save = (action: Promise<boolean>) => {
    setFailed(false)
    void action.then((saved) => {
      if (!saved) setFailed(true)
    })
  }
  const editing = { store, save, disabled: !online }

  return (
    <div className="space-y-4">
      <Link
        to={DECKS_PATH}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('nav.decks')}
      </Link>

      <DeckHeader
        deck={deck}
        catalog={catalog}
        editing={editing}
        listText={formatDeckList(deck.leaderCode, cards, byCode)}
        onRelated={(leader) => {
          // RIB-41: la scheda "Aggiungi carte" con colori, tipi ed effetti del Leader.
          update({ ...relatedFilters(leader), q: '' })
          setTab('add')
        }}
        onOpen={openCard}
      />

      <DeckWarningsPanel warnings={warnings} catalog={byCode} />
      <MissingCardsPanel
        leaderCode={deck.leaderCode}
        rows={ownership}
        catalog={byCode}
        loading={collectionEntries === null}
      />
      <ShareDeckSection deck={deck} store={store} disabled={!online} />

      {!online && <p className="text-sm text-muted-foreground">{t('decks.offline')}</p>}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('decks.saveFailed')}
        </p>
      )}

      <div
        ref={tablist}
        role="tablist"
        aria-label={t('decks.editor')}
        className="flex scroll-mt-4 rounded-full bg-muted p-1 lg:max-w-md"
      >
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`scheda-${key}`}
            aria-selected={tab === key}
            aria-controls={`pannello-${key}`}
            onClick={() => {
              setTab(key)
            }}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium',
              tab === key ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            {key === 'deck' ? (
              t('decks.tabDeck', { count: deck.cardCount, size: DECK_SIZE })
            ) : (
              <>
                <Plus className="size-4" aria-hidden="true" />
                {t('decks.tabAdd')}
              </>
            )}
          </button>
        ))}
      </div>

      <section
        id="pannello-deck"
        role="tabpanel"
        aria-labelledby="scheda-deck"
        className={cn('space-y-4', tab !== 'deck' && 'hidden')}
      >
        <DeckStatsPanel stats={stats} />
        <DeckCards
          cards={cards}
          catalog={catalog}
          editing={editing}
          flagged={flaggedCards(warnings)}
          ownership={ownershipByCode}
          onOpen={openCard}
        />
        {/* Mazzo incompleto: l'invito ad aggiungere carte in fondo alla lista (RIB-49). */}
        {deck.cardCount < DECK_SIZE && !editing.disabled && (
          <button
            type="button"
            onClick={() => {
              setTab('add')
              tablist.current?.scrollIntoView({ block: 'start' })
            }}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
          >
            <Plus className="size-4" aria-hidden="true" />
            {t('decks.addMissing', { count: DECK_SIZE - deck.cardCount })}
          </button>
        )}
      </section>
      <section
        id="pannello-add"
        role="tabpanel"
        aria-labelledby="scheda-add"
        className={cn('lg:max-w-3xl', tab !== 'add' && 'hidden')}
      >
        <AddCards cards={cards} catalog={catalog} editing={editing} onOpen={openCard} />
      </section>

      {opened && (
        <OpenedCard
          opened={opened}
          catalog={catalog}
          onSelectPrinting={(printId) => {
            void navigate(here, { replace: true, state: { ...opened, printId } })
          }}
          onClose={() => {
            void navigate(-1)
          }}
        />
      )}
    </div>
  )
}

/** Il dettaglio della carta sopra il mazzo: a tutto schermo su telefono, a destra su desktop. */
function OpenedCard({
  opened,
  catalog,
  onSelectPrinting,
  onClose,
}: {
  opened: OpenCardState
  catalog: Catalog
  onSelectPrinting: (printId: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const card = catalog.cards.find((c) => c.cardCode === opened.deckCard)
  if (!card) return null
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Su desktop il mazzo resta visibile, velato: un clic fuori chiude. */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('detail.close')}
        onClick={onClose}
        className="absolute inset-0 hidden bg-black/40 lg:block"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={card.name}
        className="relative h-full w-full overflow-y-auto bg-background safe-x lg:w-[440px] lg:border-l lg:shadow-2xl"
      >
        <CardDetail
          card={card}
          cards={catalog.cards}
          sets={catalog.sets}
          printId={opened.printId}
          onSelectPrinting={onSelectPrinting}
          onClose={onClose}
        />
      </aside>
    </div>
  )
}

interface Editing {
  store: DeckStore
  save: (action: Promise<boolean>) => void
  disabled: boolean
}

/** Apre il dettaglio di una carta, con la Printing indicata (null: la prima). */
type OpenCard = (card: CatalogCard, printId: string | null) => void

function DeckHeader({
  deck,
  catalog,
  editing,
  listText,
  onRelated,
  onOpen,
}: {
  deck: DeckSummary
  catalog: Catalog
  editing: Editing
  /** La Deck List da copiare o condividere (RIB-24). */
  listText: string
  onRelated: (leader: CatalogCard) => void
  onOpen: OpenCard
}) {
  const { t } = useTranslation()
  const [renaming, setRenaming] = useState(false)
  const leader = catalog.cards.find((c) => c.cardCode === deck.leaderCode)
  const leaderName = leader?.name ?? deck.leaderCode

  const rename = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = field(new FormData(event.currentTarget), 'name').trim()
    if (name) editing.save(editing.store.rename(name))
    setRenaming(false)
  }

  return (
    <div className="flex gap-4">
      {leader ? (
        <button
          type="button"
          onClick={() => {
            onOpen(leader, deck.leaderPrintId)
          }}
          aria-label={t('decks.openCard', { name: leaderName })}
          className="shrink-0 self-start rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <CardThumb
            printing={shownPrinting(leader, deck.leaderPrintId)}
            name={leaderName}
            className="w-20 rounded-lg sm:w-24 lg:w-32"
          />
        </button>
      ) : (
        <CardThumb printing={undefined} name={leaderName} className="w-20 shrink-0 sm:w-24" />
      )}
      <div className="min-w-0 flex-1 space-y-2">
        {renaming ? (
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
                className="h-10 w-full rounded-full border bg-background px-3 text-base"
              />
            </label>
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-full border px-3 text-sm font-medium hover:bg-muted"
            >
              {t('decks.save')}
            </button>
          </form>
        ) : (
          <div className="flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight">{deck.name}</h1>
            <button
              type="button"
              disabled={editing.disabled}
              onClick={() => {
                setRenaming(true)
              }}
              aria-label={t('decks.rename')}
              title={t('decks.rename')}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-muted disabled:opacity-50"
            >
              <Pencil className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {t('decks.leader')}: <span className="text-foreground">{leaderName}</span>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm font-medium tabular-nums" aria-live="polite">
            {t('decks.count', { count: deck.cardCount, size: DECK_SIZE })}
          </p>
          {/* Formato (RIB-23): decide gli avvisi sul Block. */}
          <div
            role="radiogroup"
            aria-label={t('decks.format')}
            className="flex rounded-full bg-muted p-0.5 text-xs"
          >
            {DECK_FORMATS.map((format) => (
              <button
                key={format}
                type="button"
                role="radio"
                aria-checked={deck.format === format}
                disabled={editing.disabled}
                onClick={() => {
                  if (format !== deck.format) editing.save(editing.store.setFormat(format))
                }}
                className={cn(
                  'rounded-full px-3 py-1 font-medium disabled:opacity-50',
                  deck.format === format ? 'bg-background shadow-sm' : 'text-muted-foreground',
                )}
              >
                {t(`decks.formats.${format}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {leader && leader.printings.length > 1 && (
            <PrintingSelect
              card={leader}
              value={deck.leaderPrintId}
              disabled={editing.disabled}
              onChange={(printId) => {
                editing.save(editing.store.setLeader(deck.leaderCode, printId))
              }}
            />
          )}
          {/* Offline (RIB-27) il Leader non si cambia: la voce sparisce. */}
          {!editing.disabled && (
            <Link
              to={deckLeaderPath(deck.id)}
              className="inline-flex h-9 items-center rounded-full border px-3 text-xs font-medium hover:bg-muted"
            >
              {t('decks.changeLeader')}
            </Link>
          )}
          {leader && (
            <button
              type="button"
              onClick={() => {
                onRelated(leader)
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted"
            >
              <ScanSearch className="size-3.5" aria-hidden="true" />
              {t('decks.related')}
            </button>
          )}
          <DeckListActions name={deck.name} text={listText} />
        </div>
      </div>
    </div>
  )
}

/** Quale Printing mostrare (per il Leader o per una carta del Deck). */
function PrintingSelect({
  card,
  value,
  disabled,
  onChange,
}: {
  card: CatalogCard
  value: string | null
  disabled: boolean
  onChange: (printId: string | null) => void
}) {
  const { t } = useTranslation()
  const base = card.printings[0]?.printId
  return (
    <label className="inline-flex items-center gap-1.5 text-xs">
      <span className="sr-only">{t('decks.printingOf', { name: card.name })}</span>
      <select
        value={value ?? base ?? ''}
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.value === base ? null : e.target.value)
        }}
        className="h-9 rounded-full border bg-background px-2 text-xs"
      >
        {card.printings.map((p) => (
          <option key={p.printId} value={p.printId}>
            {p.printId} · {p.rarity}
          </option>
        ))}
      </select>
    </label>
  )
}

function Stepper({
  name,
  quantity,
  editing,
  cardCode,
}: {
  name: string
  quantity: number
  editing: Editing
  cardCode: string
}) {
  const { t } = useTranslation()
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        disabled={editing.disabled || quantity === 0}
        onClick={() => {
          editing.save(editing.store.change(cardCode, -1))
        }}
        aria-label={t('decks.remove', { name })}
        className="inline-flex size-9 items-center justify-center rounded-full border hover:bg-muted disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden="true" />
      </button>
      <output
        aria-label={t('decks.copiesOf', { name })}
        className="w-6 text-center font-semibold tabular-nums"
      >
        {quantity}
      </output>
      <button
        type="button"
        disabled={editing.disabled || quantity >= DECK_SIZE}
        onClick={() => {
          editing.save(editing.store.change(cardCode, 1))
        }}
        aria-label={t('decks.add', { name })}
        className="inline-flex size-9 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
      >
        <Plus className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

function CardLine({
  card,
  printing,
  flagged = false,
  owned,
  tile = false,
  onOpen,
  children,
}: {
  card: CatalogCard
  printing: CatalogPrinting | undefined
  /** Coinvolta in un Deck Warning (RIB-23). */
  flagged?: boolean
  /** Copie possedute sulle richieste (RIB-25), solo nella lista del Deck. */
  owned?: MissingRow
  /** Nella griglia del mazzo su desktop (RIB-49): carta grande, controlli sotto. */
  tile?: boolean
  /** Toccando immagine o nome si apre il dettaglio (RIB-47); i controlli restano a parte. */
  onOpen: () => void
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <li
      className={cn(
        'flex items-center gap-3 py-2',
        tile && 'lg:flex-col lg:items-stretch lg:gap-2 lg:py-0',
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('decks.openCard', { name: card.name })}
        className={cn(
          'shrink-0 self-start rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          tile && 'lg:self-stretch',
        )}
      >
        <CardThumb
          printing={printing}
          name={card.name}
          className={cn('w-11', tile && 'lg:w-full lg:rounded-lg')}
        />
      </button>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-sm font-medium">
          {flagged && (
            <TriangleAlert
              className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400"
              aria-label={t('decks.flagged')}
              role="img"
            />
          )}
          <span className="truncate">{card.name}</span>
          {owned && <OwnedBadge row={owned} />}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {card.cardCode}
          {card.cost !== null && ` · ${t('decks.cost', { cost: card.cost })}`}
        </p>
      </div>
      {children}
    </li>
  )
}

function DeckCards({
  cards,
  catalog,
  editing,
  flagged,
  ownership,
  onOpen,
}: {
  cards: readonly DeckCard[]
  catalog: Catalog
  editing: Editing
  flagged: ReadonlySet<string>
  /** Copie possedute per carta (RIB-25); vuota finché la Collection non c'è. */
  ownership: ReadonlyMap<string, MissingRow>
  onOpen: OpenCard
}) {
  const { t } = useTranslation()
  const rows = useMemo(() => deckRows(cards, catalog.cards), [cards, catalog])
  if (rows.length === 0) return <p className="text-muted-foreground">{t('decks.emptyDeck')}</p>

  // Raggruppate per categoria, con il numero di carte di ognuna.
  const groups = new Map<string, DeckRow[]>()
  for (const row of rows)
    groups.set(row.card.category, [...(groups.get(row.card.category) ?? []), row])

  return (
    <div className="space-y-5">
      {[...groups].map(([category, list]) => (
        <div key={category}>
          <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {category} · {list.reduce((sum, r) => sum + r.quantity, 0)}
          </h3>
          {/* Telefono: una riga per carta. Desktop: griglia di carte grandi (RIB-49). */}
          <ul className="divide-y lg:mt-3 lg:grid lg:grid-cols-5 lg:gap-x-4 lg:gap-y-6 lg:divide-y-0 xl:grid-cols-6 2xl:grid-cols-8">
            {list.map((row) => (
              <CardLine
                key={row.card.cardCode}
                card={row.card}
                printing={row.printing}
                flagged={flagged.has(row.card.cardCode)}
                owned={ownership.get(row.card.cardCode)}
                tile
                onOpen={() => {
                  onOpen(row.card, row.printId)
                }}
              >
                <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3 lg:flex-col lg:items-stretch lg:gap-2">
                  {row.card.printings.length > 1 && (
                    <PrintingSelect
                      card={row.card}
                      value={row.printId}
                      disabled={editing.disabled}
                      onChange={(printId) => {
                        editing.save(editing.store.setPrint(row.card.cardCode, printId))
                      }}
                    />
                  )}
                  <Stepper
                    name={row.card.name}
                    quantity={row.quantity}
                    cardCode={row.card.cardCode}
                    editing={editing}
                  />
                </div>
              </CardLine>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function AddCards({
  cards,
  catalog,
  editing,
  onOpen,
}: {
  cards: readonly DeckCard[]
  catalog: Catalog
  editing: Editing
  onOpen: OpenCard
}) {
  const { t } = useTranslation()
  const { filters, update, reset } = useCatalogFilters()
  const deferred = useDeferredValue(filters)
  const [limit, setLimit] = useState(PAGE)
  const [panelOpen, setPanelOpen] = useState(false)
  const facets = useMemo(() => catalogFacets(catalog.cards), [catalog])
  // Filtro "possedute" (RIB-22): nell'editor si è sempre dentro, quindi c'è sempre.
  const ownership = useOwnership()
  const banList = useBanList()
  const results = useMemo(
    () => deckCandidates(catalog.cards, deferred, ownership, banList),
    [catalog, deferred, ownership, banList],
  )
  const active = countActiveFilters(filters)

  // Nuova ricerca: si riparte dal primo blocco.
  const [previous, setPrevious] = useState(results)
  if (previous !== results) {
    setPrevious(results)
    setLimit(PAGE)
  }

  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [panelOpen])

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-4 text-sm">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{t('catalog.search')}</span>
          <input
            type="search"
            value={filters.q}
            placeholder={t('catalog.search')}
            onChange={(e) => {
              update({ q: e.target.value }, { typing: true })
            }}
            className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            setPanelOpen(true)
          }}
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {active > 0 ? t('catalog.filtersCount', { count: active }) : t('catalog.filters')}
        </button>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('catalog.results', { count: results.length })}
        {(active > 0 || filters.q) && (
          <button
            type="button"
            onClick={reset}
            className="ml-3 font-medium text-foreground underline underline-offset-2"
          >
            {t('catalog.reset')}
          </button>
        )}
      </p>

      <ul className="divide-y">
        {results.slice(0, limit).map(({ card, printing }) => (
          <CardLine
            key={card.cardCode}
            card={card}
            printing={printing}
            onOpen={() => {
              onOpen(card, printing.printId)
            }}
          >
            <Stepper
              name={card.name}
              quantity={quantityInDeck(cards, card.cardCode)}
              cardCode={card.cardCode}
              editing={editing}
            />
          </CardLine>
        ))}
      </ul>
      {results.length > limit && (
        <button
          type="button"
          onClick={() => {
            setLimit((l) => l + PAGE)
          }}
          className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium hover:bg-muted"
        >
          {t('decks.showMore')}
        </button>
      )}

      {panelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('catalog.filters')}
          className="fixed inset-0 z-50 flex flex-col bg-background safe-x lg:inset-y-0 lg:right-0 lg:left-auto lg:w-96 lg:border-l lg:shadow-2xl"
        >
          <div className="box-content flex h-14 shrink-0 items-center gap-3 border-b px-4 safe-top">
            <span className="font-semibold">{t('catalog.filters')}</span>
            <button
              type="button"
              aria-label={t('catalog.close')}
              onClick={() => {
                setPanelOpen(false)
              }}
              className="ml-auto inline-flex size-10 items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-5">
            <FiltersPanel
              filters={filters}
              update={update}
              facets={facets}
              sets={catalog.sets}
              showOwned
            />
          </div>
          <div className="shrink-0 border-t p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <button
              type="button"
              onClick={() => {
                setPanelOpen(false)
              }}
              className="h-12 w-full rounded-full bg-foreground text-sm font-medium text-background"
            >
              {t('catalog.showResults', { count: results.length })}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
