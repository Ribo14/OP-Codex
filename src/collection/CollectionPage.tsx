import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { RequireAccount } from '@/account/ProfilePage'
import { useSession } from '@/account/session'
import { SignedOutInvite } from '@/account/SignedOutInvite'
import { cardImageUrl } from '@/catalog/card-image'
import { cardPath } from '@/catalog/card-links'
import type { CardLinkState } from '@/catalog/CardDetailRoute'
import { useCatalog } from '@/catalog/local-catalog'
import {
  COLLECTION_SORTS,
  ownedItems,
  searchOwned,
  totals,
  type CollectionSort,
  type OwnedItem,
} from './collection'
import { useCollection } from './collection-store'
import { SetCompletionSection } from './SetCompletionSection'

// Pagina Collezione (RIB-20): le Printing possedute con le copie, totali, ricerca e ordinamento.

const COLLECTION_PATH = '/collezione'

// Chiudere il dettaglio aperto da qui torna alla Collezione (navigate(-1)).
const LINK_STATE: CardLinkState = { fromCatalog: true }

export function CollectionPage() {
  const { t } = useTranslation()
  const session = useSession()
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{t('nav.collection')}</h1>
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
  const { catalog } = useCatalog()
  const { state, reload } = useCollection(userId)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<CollectionSort>('code')

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
        <Link to="/" className="text-sm underline underline-offset-2">
          {t('collection.toCatalog')}
        </Link>
      </div>
    )
  }

  const { copies, distinctCards } = totals(entries)
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t('collection.totals', { copies, cards: distinctCards })}
      </p>
      <SetCompletionSection catalog={catalog} entries={entries} />
      <h2 className="pt-2 text-lg font-semibold tracking-tight">{t('collection.yourCards')}</h2>
      <div className="flex flex-wrap gap-3">
        <label className="relative min-w-0 flex-1 basis-60">
          <span className="sr-only">{t('collection.search')}</span>
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
            }}
            placeholder={t('collection.search')}
            className="h-11 w-full rounded-full bg-muted pr-4 pl-10 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('collection.sortLabel')}</span>
          <select
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as CollectionSort)
            }}
            className="h-11 rounded-full border bg-background px-3 text-sm"
          >
            {COLLECTION_SORTS.map((option) => (
              <option key={option} value={option}>
                {t(`collection.sort.${option}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {shown.length === 0 ? (
        <p className="text-muted-foreground">{t('collection.noResults')}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6 xl:grid-cols-5 2xl:grid-cols-6">
          {shown.map((item) => (
            <OwnedTile key={item.printing.printId} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}

function OwnedTile({ item }: { item: OwnedItem }) {
  const { t } = useTranslation()
  const { card, printing } = item
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
              src={cardImageUrl(printing.printId, 'thumb')}
              crossOrigin="anonymous"
              alt={card.name}
              width={300}
              height={419}
              loading="lazy"
              decoding="async"
              className="h-auto w-full rounded-xl bg-muted shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-xl group-focus-visible:ring-2 group-focus-visible:ring-ring"
            />
          ) : (
            <div
              role="img"
              aria-label={t('catalog.imagePending', { name: card.name })}
              className="flex aspect-[300/419] w-full items-center justify-center rounded-xl bg-muted p-2 text-center text-[10px] text-muted-foreground"
            >
              {card.name}
            </div>
          )}
          <span
            className="absolute top-2 right-2 rounded-full bg-foreground px-2 py-0.5 text-xs font-semibold text-background tabular-nums shadow"
            aria-label={t('collection.copies', { count: item.total })}
          >
            ×{item.total}
          </span>
        </div>
        <span className="mt-2 block truncate text-sm font-medium">{card.name}</span>
        <span className="block text-xs text-muted-foreground">
          {printing.printId}
          {' · '}
          {item.byLanguage.map(([language, count]) => `${language} ${String(count)}`).join(' · ')}
        </span>
      </Link>
    </li>
  )
}
