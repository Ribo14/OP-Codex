import { ArrowLeft, Search } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { RequireAccount } from '@/account/ProfilePage'
import { useSession } from '@/account/session'
import { SignedOutInvite } from '@/account/SignedOutInvite'
import type { CatalogCard } from '@/catalog/catalog-data'
import { COLORS } from '@/catalog/filters'
import { gameColor } from '@/catalog/game-colors'
import { useCatalog } from '@/catalog/local-catalog'
import { toggle } from '@/catalog/use-catalog-filters'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'
import { CardThumb } from './CardThumb'
import { leaderCandidates } from './deck'
import { deckStore } from './deck-store'
import { createDeck, setLeader } from './decks-api'
import { deckPath, DECKS_PATH } from './paths'

// Scelta del Leader (RIB-21): per un Deck nuovo (/mazzi/nuovo) o per cambiarlo
// (/mazzi/:deckId/leader). Il nuovo Deck prende il nome del Leader.

const PAGE = 60

export function LeaderPickerPage() {
  const { t } = useTranslation()
  const session = useSession()
  const { deckId } = useParams()
  return (
    <div className="space-y-5">
      <Link
        to={deckId ? deckPath(deckId) : DECKS_PATH}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {deckId ? t('decks.backToDeck') : t('nav.decks')}
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
        {deckId ? t('decks.changeLeader') : t('decks.chooseLeader')}
      </h1>
      {session.status === 'signedOut' ? (
        <SignedOutInvite text={t('decks.signedOut')} returnTo={DECKS_PATH} />
      ) : (
        <RequireAccount>{() => <Picker deckId={deckId ?? null} />}</RequireAccount>
      )}
    </div>
  )
}

function Picker({ deckId }: { deckId: string | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { catalog } = useCatalog()
  const [q, setQ] = useState('')
  const [colors, setColors] = useState<string[]>([])
  const [limit, setLimit] = useState(PAGE)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const deferredQ = useDeferredValue(q)

  const leaders = useMemo(
    () => (catalog ? leaderCandidates(catalog.cards, { q: deferredQ, colors }) : []),
    [catalog, deferredQ, colors],
  )
  // Offline (RIB-27) il Leader non si sceglie: servirebbe salvare sul server.
  const online = useOnline()

  const pick = (card: CatalogCard) => {
    setBusy(true)
    setFailed(false)
    const done = deckId
      ? setLeader(deckId, card.cardCode, null).then(async () => {
          // L'editor, se aveva già caricato il Deck, rilegge il Leader nuovo.
          if (deckStore().deckId() === deckId) await deckStore().reload()
          return deckId
        })
      : createDeck(card.name.slice(0, 60), card.cardCode)
    void done.then(
      (id) => {
        void navigate(deckPath(id), { replace: true })
      },
      () => {
        setBusy(false)
        setFailed(true)
      },
    )
  }

  if (!catalog) return <p className="text-muted-foreground">{t('catalog.loading')}</p>

  return (
    <div className="space-y-4">
      <label className="flex h-11 max-w-md items-center gap-2 rounded-full bg-muted px-4 text-sm">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{t('decks.searchLeader')}</span>
        <input
          type="search"
          value={q}
          placeholder={t('decks.searchLeader')}
          onChange={(e) => {
            setQ(e.target.value)
            setLimit(PAGE)
          }}
          className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </label>
      <div role="group" aria-label={t('filters.colors')} className="flex flex-wrap gap-2">
        {COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-pressed={colors.includes(color)}
            onClick={() => {
              setColors((current) => toggle(current, color))
              setLimit(PAGE)
            }}
            className={cn(
              'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium',
              colors.includes(color)
                ? 'border-foreground bg-foreground text-background'
                : 'hover:bg-muted',
            )}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ background: gameColor(color) }}
              aria-hidden="true"
            />
            {t(`color.${color}`)}
          </button>
        ))}
      </div>
      {!online && <p className="text-sm text-muted-foreground">{t('decks.offline')}</p>}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('decks.saveFailed')}
        </p>
      )}
      {leaders.length === 0 ? (
        <p className="text-muted-foreground">{t('catalog.noResults')}</p>
      ) : (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-7">
          {leaders.slice(0, limit).map(({ card, printing }) => (
            <li key={card.cardCode}>
              <button
                type="button"
                disabled={busy || !online}
                onClick={() => {
                  pick(card)
                }}
                className="group block w-full rounded-xl text-left focus-visible:outline-none disabled:opacity-60"
              >
                <CardThumb
                  printing={printing}
                  name={card.name}
                  className="w-full rounded-xl transition group-hover:-translate-y-1 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                />
                <span className="mt-1.5 block truncate text-xs font-medium">{card.name}</span>
                <span className="block text-[11px] text-muted-foreground">{card.cardCode}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {leaders.length > limit && (
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
    </div>
  )
}
