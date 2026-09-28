import { Check, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { RequireAccount } from '@/account/ProfilePage'
import { useOnline } from '@/lib/use-online'
import { acceptRequest, inviter, sendRequest, type FoundUser } from './friends-api'
import { FRIENDS_PATH } from './paths'

// Link di invito (RIB-71): chi lo apre (dopo l'accesso) vede chi l'ha invitato e manda la
// Friend Request con un tocco; l'amicizia parte solo quando l'altro accetta. Un link rigenerato,
// il proprio link o un blocco tra i due danno lo stesso messaggio di link non valido.

export function InvitePage() {
  const { t } = useTranslation()
  const { token = '' } = useParams()
  return (
    <div className="mx-auto max-w-md space-y-6 py-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('friends.invitePage.title')}</h1>
      <RequireAccount>{() => <Invite key={token} token={token} />}</RequireAccount>
    </div>
  )
}

function Invite({ token }: { token: string }) {
  const { t } = useTranslation()
  const online = useOnline()
  const [found, setFound] = useState<FoundUser | null | undefined>(undefined)
  const [failed, setFailed] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    inviter(token).then(setFound, () => {
      setFailed(true)
    })
  }, [token])

  const act = (action: () => Promise<unknown>) => {
    if (!found) return
    setBusy(true)
    setFailed(false)
    action()
      .then(
        () => inviter(token).then(setFound),
        () => {
          setFailed(true)
        },
      )
      .finally(() => {
        setBusy(false)
      })
  }

  if (failed && found === undefined) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {t('friends.actionFailed')}
      </p>
    )
  }
  if (found === undefined) return <p className="text-muted-foreground">{t('account.loading')}</p>
  if (found === null) {
    return (
      <div className="space-y-3">
        <p className="text-sm">{t('friends.invitePage.invalid')}</p>
        <Link to={FRIENDS_PATH} className="text-sm underline underline-offset-2">
          {t('friends.invitePage.toFriends')}
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-4 rounded-2xl border p-5">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-foreground text-lg font-semibold text-background uppercase"
        >
          {found.username.charAt(0)}
        </span>
        <p className="min-w-0 text-sm">
          {t('friends.invitePage.from', { username: found.username })}
        </p>
      </div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {t(`friends.invitePage.${found.relation}`, { username: found.username })}
      </p>
      {found.relation === 'nessuno' && (
        <button
          type="button"
          disabled={busy || !online}
          onClick={() => {
            act(() => sendRequest(found.username))
          }}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background disabled:opacity-50"
        >
          <UserPlus className="size-4" aria-hidden="true" />
          {t('friends.add.send')}
        </button>
      )}
      {found.relation === 'ricevuta' && (
        <button
          type="button"
          disabled={busy || !online}
          onClick={() => {
            act(() => acceptRequest(found.username))
          }}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background disabled:opacity-50"
        >
          <Check className="size-4" aria-hidden="true" />
          {t('friends.received.accept')}
        </button>
      )}
      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('friends.actionFailed')}
        </p>
      )}
      <Link to={FRIENDS_PATH} className="block text-sm underline underline-offset-2">
        {t('friends.invitePage.toFriends')}
      </Link>
    </div>
  )
}
