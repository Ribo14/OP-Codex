import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { RequireAccount } from '@/account/ProfilePage'
import type { SharedDeck } from '@/decks/decks-api'
import { SharedDeckView } from '@/decks/SharedDeckPage'
import { loadFriendDeck } from './friends-api'
import { friendProfilePath } from './paths'

// Un mazzo di un amico (RIB-73), in sola lettura come uno Share Link: avvisi, statistiche,
// carte, "Copia lista" e "Salva nei miei mazzi". Solo se il mazzo è su Amici o Link pubblico.

export function FriendDeckPage() {
  const { username = '', deckId = '' } = useParams()
  return (
    <RequireAccount>
      {() => <FriendDeck key={deckId} username={username} deckId={deckId} />}
    </RequireAccount>
  )
}

function FriendDeck({ username, deckId }: { username: string; deckId: string }) {
  const { t } = useTranslation()
  const [deck, setDeck] = useState<SharedDeck | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    loadFriendDeck(deckId).then(setDeck, () => {
      setFailed(true)
    })
  }, [deckId])

  const back = (
    <Link
      to={friendProfilePath(username)}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('friends.profile.back', { username })}
    </Link>
  )

  if (failed) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t('friends.loadFailed')}
      </p>
    )
  }
  if (deck === undefined) return <p className="text-muted-foreground">{t('decks.loadingDeck')}</p>
  if (deck === null) {
    return (
      <div className="mx-auto max-w-md space-y-3 py-6">
        {back}
        <p role="alert">{t('friends.profile.deckMissing')}</p>
      </div>
    )
  }
  return <SharedDeckView deck={deck} label={t('friends.profile.deckLabel')} back={back} />
}
