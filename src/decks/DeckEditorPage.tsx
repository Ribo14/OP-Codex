import {
  ArrowLeft,
  Minus,
  Pencil,
  Plus,
  ScanSearch,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { field } from '@/account/form-data'
import { RequireAccount } from '@/account/ProfilePage'
import { useSession } from '@/account/session'
import { SignedOutInvite } from '@/account/SignedOutInvite'
import type { Catalog, CatalogCard, CatalogPrinting } from '@/catalog/catalog-data'
import { catalogFacets, countActiveFilters, relatedFilters } from '@/catalog/filters'
import { FiltersPanel } from '@/catalog/FiltersPanel'
import { useCatalog } from '@/catalog/local-catalog'
import { useCatalogFilters } from '@/catalog/use-catalog-filters'
import { useOwnership } from '@/collection/collection-store'
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
import { useDeck, type DeckStore } from './deck-store'
import { deckLeaderPath, DECKS_PATH } from './paths'

// Editor di un Deck (RIB-21). Ogni modifica si salva da sola. Sul telefono due schede, "Mazzo" e
// "Aggiungi carte", che non perdono ricerca e filtri; su schermi larghi sono affiancate.

const PAGE = 40
const TABS = ['deck', 'add'] as const

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
        onRelated={(leader) => {
          // RIB-41: la scheda "Aggiungi carte" con colori, tipi ed effetti del Leader.
          update({ ...relatedFilters(leader), q: '' })
          setTab('add')
        }}
      />

      {!online && <p className="text-sm text-muted-foreground">{t('decks.offline')}</p>}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('decks.saveFailed')}
        </p>
      )}

      {/* Telefono: due schede. Da lg le due parti sono affiancate. */}
      <div
        role="tablist"
        aria-label={t('decks.editor')}
        className="flex rounded-full bg-muted p-1 lg:hidden"
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
              'flex-1 rounded-full px-3 py-2 text-sm font-medium',
              tab === key ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            {key === 'deck'
              ? t('decks.tabDeck', { count: deck.cardCount, size: DECK_SIZE })
              : t('decks.tabAdd')}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-8">
        <section
          id="pannello-deck"
          role="tabpanel"
          aria-labelledby="scheda-deck"
          className={cn(tab !== 'deck' && 'hidden lg:block')}
        >
          <h2 className="mb-3 hidden text-lg font-semibold tracking-tight lg:block">
            {t('decks.tabDeck', { count: deck.cardCount, size: DECK_SIZE })}
          </h2>
          <DeckCards cards={cards} catalog={catalog} editing={editing} />
        </section>
        <section
          id="pannello-add"
          role="tabpanel"
          aria-labelledby="scheda-add"
          className={cn(tab !== 'add' && 'hidden lg:block')}
        >
          <h2 className="mb-3 hidden text-lg font-semibold tracking-tight lg:block">
            {t('decks.tabAdd')}
          </h2>
          <AddCards cards={cards} catalog={catalog} editing={editing} />
        </section>
      </div>
    </div>
  )
}

interface Editing {
  store: DeckStore
  save: (action: Promise<boolean>) => void
  disabled: boolean
}

function DeckHeader({
  deck,
  catalog,
  editing,
  onRelated,
}: {
  deck: DeckSummary
  catalog: Catalog
  editing: Editing
  onRelated: (leader: CatalogCard) => void
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
      <CardThumb
        printing={leader ? shownPrinting(leader, deck.leaderPrintId) : undefined}
        name={leaderName}
        className="w-20 shrink-0 rounded-lg sm:w-24"
      />
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
        <p className="text-sm font-medium tabular-nums" aria-live="polite">
          {t('decks.count', { count: deck.cardCount, size: DECK_SIZE })}
        </p>
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
          <Link
            to={deckLeaderPath(deck.id)}
            className="inline-flex h-9 items-center rounded-full border px-3 text-xs font-medium hover:bg-muted"
          >
            {t('decks.changeLeader')}
          </Link>
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
  children,
}: {
  card: CatalogCard
  printing: CatalogPrinting | undefined
  children: React.ReactNode
}) {
  const { t } = useTranslation()
  return (
    <li className="flex items-center gap-3 py-2">
      <CardThumb printing={printing} name={card.name} className="w-11 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{card.name}</p>
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
}: {
  cards: readonly DeckCard[]
  catalog: Catalog
  editing: Editing
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
          <ul className="divide-y">
            {list.map((row) => (
              <CardLine key={row.card.cardCode} card={row.card} printing={row.printing}>
                <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
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
}: {
  cards: readonly DeckCard[]
  catalog: Catalog
  editing: Editing
}) {
  const { t } = useTranslation()
  const { filters, update, reset } = useCatalogFilters()
  const deferred = useDeferredValue(filters)
  const [limit, setLimit] = useState(PAGE)
  const [panelOpen, setPanelOpen] = useState(false)
  const facets = useMemo(() => catalogFacets(catalog.cards), [catalog])
  // Filtro "possedute" (RIB-22): nell'editor si è sempre dentro, quindi c'è sempre.
  const ownership = useOwnership()
  const results = useMemo(
    () => deckCandidates(catalog.cards, deferred, ownership),
    [catalog, deferred, ownership],
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
          <CardLine key={card.cardCode} card={card} printing={printing}>
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
