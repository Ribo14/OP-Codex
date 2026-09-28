import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { RequireAccount } from '@/account/ProfilePage'
import { LogoLoader } from '@/app/LogoLoader'
import { useCatalog } from '@/catalog/local-catalog'
import type { CollectionEntry } from '@/collection/collection'
import { ownedItems, searchOwned } from '@/collection/collection'
import { OwnedTile } from '@/collection/CollectionPage'
import { SetCompletionSection } from '@/collection/SetCompletionSection'
import { CardThumb } from '@/decks/CardThumb'
import { DECK_SIZE, shownPrinting } from '@/decks/deck'
import { loadFriendCollection, loadFriendProfile, type FriendProfile } from './friends-api'
import { MoreMenu } from './FriendsPage'
import { friendDeckPath, FRIENDS_PATH } from './paths'

// Profilo di un amico (RIB-73, ADR-0015): i suoi mazzi Amici e Link pubblico e, se l'ha resa
// visibile, la sua Collection con la Set Completion. Mai il valore stimato. Chi non è amico (o
// è bloccato, o lo Username non esiste) vede lo stesso messaggio.

export function FriendProfilePage() {
  const { username = '' } = useParams()
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackToFriends />
      <RequireAccount>{() => <Profile key={username} username={username} />}</RequireAccount>
    </div>
  )
}

function BackToFriends() {
  const { t } = useTranslation()
  return (
    <Link
      to={FRIENDS_PATH}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('friends.title')}
    </Link>
  )
}

function Profile({ username }: { username: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<FriendProfile | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    loadFriendProfile(username).then(setProfile, () => {
      setFailed(true)
    })
  }, [username])

  if (failed) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t('friends.loadFailed')}
      </p>
    )
  }
  if (profile === undefined) return <p className="text-muted-foreground">{t('account.loading')}</p>
  if (profile === null) {
    return <p className="text-sm">{t('friends.profile.missing')}</p>
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <span
          aria-hidden="true"
          className="inline-flex size-14 shrink-0 items-center justify-center rounded-full bg-foreground text-xl font-semibold text-background uppercase"
        >
          {profile.username.charAt(0)}
        </span>
        <h1 className="min-w-0 flex-1 truncate text-2xl font-semibold tracking-tight lg:text-3xl">
          @{profile.username}
        </h1>
        <MoreMenu
          username={profile.username}
          remove
          done={() => {
            void navigate(FRIENDS_PATH)
          }}
        />
      </div>

      <section aria-labelledby="amico-mazzi" className="space-y-3">
        <h2 id="amico-mazzi" className="text-lg font-semibold tracking-tight">
          {t('friends.profile.decks', { count: profile.decks.length })}
        </h2>
        {profile.decks.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('friends.profile.noDecks')}</p>
        ) : (
          <FriendDecks profile={profile} />
        )}
      </section>

      <section aria-labelledby="amico-collezione" className="space-y-3">
        <h2 id="amico-collezione" className="text-lg font-semibold tracking-tight">
          {t('nav.collection')}
        </h2>
        {profile.collectionVisible ? (
          <FriendCollection username={profile.username} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t('friends.profile.privateCollection', { username: profile.username })}
          </p>
        )}
      </section>
    </>
  )
}

function FriendDecks({ profile }: { profile: FriendProfile }) {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const byCode = useMemo(
    () => new Map((catalog?.cards ?? []).map((card) => [card.cardCode, card])),
    [catalog],
  )
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {profile.decks.map((deck) => {
        const leader = byCode.get(deck.leaderCode)
        return (
          <li key={deck.id}>
            <Link
              to={friendDeckPath(profile.username, deck.id)}
              className="flex items-center gap-3 rounded-2xl border p-3 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <CardThumb
                printing={leader ? shownPrinting(leader, deck.leaderPrintId) : undefined}
                name={leader?.name ?? deck.leaderCode}
                className="w-14 shrink-0 rounded-md"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{deck.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {leader?.name ?? deck.leaderCode}
                </span>
                <span className="block text-xs text-muted-foreground tabular-nums">
                  {t('decks.count', { count: deck.cardCount, size: DECK_SIZE })} ·{' '}
                  {t(`decks.formats.${deck.format}`)}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** La Collection dell'amico: Set Completion e carte, senza valore stimato (ADR-0015). */
function FriendCollection({ username }: { username: string }) {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const [entries, setEntries] = useState<CollectionEntry[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    loadFriendCollection(username).then(setEntries, () => {
      setFailed(true)
    })
  }, [username])

  const items = useMemo(
    () => searchOwned(ownedItems(entries ?? [], catalog?.cards ?? []), '', 'code'),
    [entries, catalog],
  )

  if (failed) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t('friends.loadFailed')}
      </p>
    )
  }
  if (!catalog) return <LogoLoader label={t('catalog.loading')} />
  if (!entries) return <p className="text-muted-foreground">{t('collection.loading')}</p>
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('friends.profile.emptyCollection')}</p>
  }
  const copies = entries.reduce((sum, e) => sum + e.quantity, 0)
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        {t('collection.totals', { copies, cards: new Set(items.map((i) => i.card.cardCode)).size })}
      </p>
      <SetCompletionSection catalog={catalog} entries={entries} />
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6 xl:grid-cols-5">
        {items.map((item) => (
          <OwnedTile key={item.printing.printId} item={item} />
        ))}
      </ul>
    </div>
  )
}
