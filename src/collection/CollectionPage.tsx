import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { RequireAccount } from '@/account/ProfilePage'
import { useSession } from '@/account/session'
import { FriendsShortcut } from '@/friends/FriendsShortcut'
import { SignedOutInvite } from '@/account/SignedOutInvite'
import { cardImageUrl } from '@/catalog/card-image'
import { cardPath } from '@/catalog/card-links'
import type { CardLinkState } from '@/catalog/CardDetailRoute'
import { gridColumns, useGridSize, type GridSize } from '@/catalog/grid-size'
import { ViewMenu } from '@/catalog/ViewMenu'
import { useCatalog } from '@/catalog/local-catalog'
import { useEuro } from '@/catalog/price-format'
import { MenuChoices, MenuLabel, MenuSeparator } from '@/components/Menu'
import { SearchField } from '@/components/SearchField'
import { cn } from '@/lib/utils'
import { collectionValue } from '@/catalog/price-value'
import {
  COLLECTION_SORTS,
  ownedItems,
  searchOwned,
  totals,
  type CollectionSort,
  type OwnedItem,
} from './collection'
import { useCollection } from './collection-store'
import { CollectionVisibilityRow } from './CollectionVisibility'
import { BULK_ADD_PATH, COLLECTION_PATH } from './paths'
import { SetCompletionSection } from './SetCompletionSection'

// Pagina Collezione (RIB-20): le Printing possedute con le copie, totali, ricerca e ordinamento.

// Chiudere il dettaglio aperto da qui torna alla Collezione (navigate(-1)).
const LINK_STATE: CardLinkState = { fromCatalog: true }

export function CollectionPage() {
  const { t } = useTranslation()
  const session = useSession()
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="min-w-0 flex-1 text-2xl font-semibold tracking-tight lg:text-3xl">
          {t('nav.collection')}
        </h1>
        {/* Collezione e mazzi degli amici, a un tocco (prima solo nella pagina dell'amico). */}
        {session.status === 'signedIn' && <FriendsShortcut section="collection" />}
      </div>
      {session.status === 'signedOut' ? (
        <SignedOutInvite text={t('collection.signedOut')} returnTo={COLLECTION_PATH} />
      ) : (
        <RequireAccount>{({ user }) => <Collection userId={user.id} />}</RequireAccount>
      )}
    </div>
  )
}

function Collection({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const euro = useEuro()
  const { catalog } = useCatalog()
  const { state, reload } = useCollection(userId)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<CollectionSort>('code')
  const [gridSize, setGridSize] = useGridSize()

  const entries = useMemo(() => (state.status === 'ready' ? state.entries : []), [state])
  const items = useMemo(() => ownedItems(entries, catalog?.cards ?? []), [entries, catalog])
  const shown = useMemo(() => searchOwned(items, query, sort), [items, query, sort])

  if (state.status === 'error') {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-destructive">
          {t('collection.loadFailed')}
        </p>
        <button
          type="button"
          onClick={() => void reload()}
          className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium hover:bg-muted"
        >
          {t('collection.retry')}
        </button>
      </div>
    )
  }
  if (state.status === 'loading' || !catalog) {
    return <p className="text-muted-foreground">{t('collection.loading')}</p>
  }
  if (entries.length === 0) {
    return (
      <div className="max-w-md space-y-3 rounded-2xl border p-5">
        <p>{t('collection.empty')}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          <Link to="/" className="underline underline-offset-2">
            {t('collection.toCatalog')}
          </Link>
          <BulkLink />
        </div>
      </div>
    )
  }

  const { copies, distinctCards } = totals(entries)
  // RIB-32: valore stimato con i prezzi Cardmarket delle stampe inglesi.
  const value = collectionValue(entries, catalog.cards)
  return (
    <div className="space-y-5">
      {/* RIB-70: il valore stimato in evidenza; RIB-88: in un riquadro basso, accanto ai totali,
          così le carte arrivano prima. Su tablet e PC accanto alla visibilità. */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:items-start">
        <section
          aria-labelledby="valore-collezione"
          className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1 rounded-2xl border bg-muted/40 px-4 py-3"
        >
          <div>
            <h2 id="valore-collezione" className="text-xs text-muted-foreground">
              {t('collection.valueTitle')}
            </h2>
            <p className="text-2xl font-semibold tracking-tight tabular-nums lg:text-3xl">
              {value.priced > 0 ? euro(value.total) : '—'}
            </p>
          </div>
          <p className="text-sm tabular-nums" aria-live="polite">
            {t('collection.totals', { copies, cards: distinctCards })}
          </p>
          <p className="w-full text-xs text-muted-foreground">
            {[
              t('collection.valueSource'),
              value.unpriced > 0 && t('collection.unpriced', { count: value.unpriced }),
              value.otherLanguages > 0 &&
                t('collection.otherLanguages', { count: value.otherLanguages }),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </section>
        <CollectionVisibilityRow userId={userId} />
      </div>
      <SetCompletionSection catalog={catalog} entries={entries} />
      <div className="flex items-center justify-between gap-3 pt-2">
        <h2 className="text-lg font-semibold tracking-tight">{t('collection.yourCards')}</h2>
        <span className="text-sm">
          <BulkLink />
        </span>
      </div>
      {/* RIB-88: ricerca, ordine e vista in una riga. */}
      <div className="flex items-center gap-2">
        <SearchField
          value={query}
          label={t('collection.search')}
          onChange={setQuery}
          className="min-w-0 flex-1"
        />
        {/* L'ordinamento sta nel menu della vista: la ricerca ha tutta la riga (RIB-88). */}
        <ViewMenu
          value={gridSize}
          onChange={(choice) => {
            if (choice !== 'list') setGridSize(choice)
          }}
          withList={false}
        >
          <MenuSeparator />
          <MenuLabel>{t('collection.sortLabel')}</MenuLabel>
          <MenuChoices<CollectionSort>
            value={sort}
            onChange={setSort}
            options={COLLECTION_SORTS.map((option) => ({
              value: option,
              label: t(`collection.sort.${option}`),
              icon: null,
            }))}
          />
        </ViewMenu>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground">{t('collection.noResults')}</p>
      ) : (
        <ul className={gridColumns(gridSize)}>
          {shown.map((item) => (
            <OwnedTile key={item.printing.printId} item={item} size={gridSize} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** Verso l'aggiunta in blocco: un Set intero o una lista. */
function BulkLink() {
  const { t } = useTranslation()
  return (
    <Link
      to={BULK_ADD_PATH}
      className="inline-flex items-center gap-1 font-medium underline underline-offset-2"
    >
      <Plus className="size-3.5" aria-hidden="true" />
      {t('collection.bulkLink')}
    </Link>
  )
}

/** Una Printing posseduta, con le copie; serve anche alla Collection di un amico (RIB-73). */
export function OwnedTile({ item, size = 'large' }: { item: OwnedItem; size?: GridSize }) {
  const { t } = useTranslation()
  const { card, printing } = item
  const radius = size === 'large' ? 'rounded-xl' : 'rounded-md'
  return (
    <li className="[content-visibility:auto]">
      <Link
        to={cardPath(card.cardCode, new URLSearchParams(), printing.printId)}
        state={LINK_STATE}
        className="group block rounded-xl focus-visible:outline-none"
      >
        <div className="relative">
          {printing.hasImage ? (
            <img
              src={cardImageUrl(printing, 'thumb')}
              crossOrigin="anonymous"
              alt={card.name}
              width={300}
              height={419}
              loading="lazy"
              decoding="async"
              className={cn(
                'h-auto w-full bg-muted shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-xl group-focus-visible:ring-2 group-focus-visible:ring-ring',
                radius,
              )}
            />
          ) : (
            <div
              role="img"
              aria-label={t('catalog.imagePending', { name: card.name })}
              className={cn(
                'flex aspect-[300/419] w-full items-center justify-center bg-muted p-1 text-center text-[10px] text-muted-foreground',
                radius,
              )}
            >
              {card.name}
            </div>
          )}
          {/* RIB-79: con le carte piccole resta solo il numero di copie, più piccolo. */}
          <span
            className={cn(
              'absolute rounded-full bg-foreground font-semibold text-background tabular-nums shadow',
              size === 'large'
                ? 'top-2 right-2 px-2 py-0.5 text-xs'
                : 'top-1 right-1 px-1.5 text-[10px]',
            )}
            aria-label={t('collection.copies', { count: item.total })}
          >
            ×{item.total}
          </span>
        </div>
        {size === 'large' && (
          <>
            <span className="mt-2 block truncate text-sm font-medium">{card.name}</span>
            <span className="block text-xs text-muted-foreground">
              {printing.printId}
              {' · '}
              {item.byLanguage
                .map(([language, count]) => `${language} ${String(count)}`)
                .join(' · ')}
            </span>
          </>
        )}
        {size === 'medium' && (
          <span className="mt-1 block truncate text-[11px] text-muted-foreground">
            {printing.printId}
          </span>
        )}
      </Link>
    </li>
  )
}
