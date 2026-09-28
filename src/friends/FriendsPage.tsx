import { Check, Copy, RefreshCw, Search, Share2, UserPlus, X } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { field } from '@/account/form-data'
import { RequireAccount } from '@/account/ProfilePage'
import { canShare, copyText } from '@/lib/clipboard'
import { useOnline } from '@/lib/use-online'
import {
  acceptRequest,
  cancelRequest,
  inviteToken,
  loadFriends,
  regenerateInvite,
  rejectRequest,
  searchUser,
  sendRequest,
  type FoundUser,
  type FriendsState,
} from './friends-api'
import { friendInviteUrl } from './paths'

// Pagina Amici (RIB-71): cerca uno Username esatto, link di invito, richieste ricevute e
// inviate, elenco degli amici. Le regole (blocchi, doppioni) le fa rispettare il database.

const BUTTON =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50'
const PRIMARY =
  'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50'

export function FriendsPage() {
  const { t } = useTranslation()
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{t('friends.title')}</h1>
      <RequireAccount>{() => <Friends />}</RequireAccount>
    </div>
  )
}

function Friends() {
  const { t } = useTranslation()
  const [state, setState] = useState<FriendsState | null>(null)
  const [failed, setFailed] = useState(false)

  const reload = useCallback(() => {
    loadFriends().then(
      (s) => {
        setState(s)
        setFailed(false)
      },
      () => {
        setFailed(true)
      },
    )
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <>
      <Section id="aggiungi" title={t('friends.add.title')}>
        <div className="space-y-4 rounded-2xl border p-4">
          <SearchUser onChanged={reload} />
          <InviteLink />
        </div>
      </Section>

      {failed && (
        <p role="alert" className="text-sm text-destructive">
          {t('friends.loadFailed')}
        </p>
      )}
      {!state && !failed && <p className="text-muted-foreground">{t('account.loading')}</p>}

      {state && state.received.length > 0 && (
        <Section
          id="ricevute"
          title={t('friends.received.title', { count: state.received.length })}
        >
          <UserList>
            {state.received.map((r) => (
              <UserRow key={r.username} username={r.username}>
                <Action
                  className={PRIMARY}
                  label={t('friends.received.accept')}
                  icon={<Check className="size-3.5" aria-hidden="true" />}
                  run={() => acceptRequest(r.username)}
                  done={reload}
                  describe={t('friends.received.acceptLabel', { username: r.username })}
                />
                <Action
                  className={BUTTON}
                  label={t('friends.received.reject')}
                  icon={<X className="size-3.5" aria-hidden="true" />}
                  run={() => rejectRequest(r.username)}
                  done={reload}
                  describe={t('friends.received.rejectLabel', { username: r.username })}
                />
              </UserRow>
            ))}
          </UserList>
        </Section>
      )}

      {state && (
        <Section id="amici" title={t('friends.list.title', { count: state.friends.length })}>
          {state.friends.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('friends.list.empty')}</p>
          ) : (
            <UserList>
              {state.friends.map((f) => (
                <UserRow key={f.username} username={f.username} />
              ))}
            </UserList>
          )}
        </Section>
      )}

      {state && state.sent.length > 0 && (
        <Section id="inviate" title={t('friends.sent.title', { count: state.sent.length })}>
          <UserList>
            {state.sent.map((r) => (
              <UserRow key={r.username} username={r.username} hint={t('friends.sent.waiting')}>
                <Action
                  className={BUTTON}
                  label={t('friends.sent.cancel')}
                  icon={<X className="size-3.5" aria-hidden="true" />}
                  run={() => cancelRequest(r.username)}
                  done={reload}
                  describe={t('friends.sent.cancelLabel', { username: r.username })}
                />
              </UserRow>
            ))}
          </UserList>
        </Section>
      )}
    </>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`amici-${id}`} className="space-y-2">
      <h2
        id={`amici-${id}`}
        className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function UserList({ children }: { children: ReactNode }) {
  return <ul className="divide-y overflow-hidden rounded-2xl border">{children}</ul>
}

function UserRow({
  username,
  hint,
  children,
}: {
  username: string
  hint?: string
  children?: ReactNode
}) {
  return (
    // flex-wrap: sul telefono stretto i pulsanti scendono sotto il nome invece di troncarlo.
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <span
        aria-hidden="true"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold uppercase"
      >
        {username.charAt(0)}
      </span>
      <div className="min-w-[9rem] flex-1">
        <p className="truncate text-sm font-medium">@{username}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children && <div className="ml-auto flex gap-2">{children}</div>}
    </li>
  )
}

/** Un pulsante che chiama il database; se fallisce lo dice accanto. */
function Action({
  label,
  describe,
  icon,
  className,
  run,
  done,
}: {
  label: string
  describe: string
  icon: ReactNode
  className: string
  run: () => Promise<unknown>
  done: () => void
}) {
  const { t } = useTranslation()
  const online = useOnline()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={describe}
        disabled={busy || !online}
        onClick={() => {
          setBusy(true)
          setFailed(false)
          run().then(
            () => {
              setBusy(false)
              done()
            },
            () => {
              setBusy(false)
              setFailed(true)
            },
          )
        }}
        className={className}
      >
        {icon}
        {label}
      </button>
      {failed && (
        <span role="alert" className="self-center text-xs text-destructive">
          {t('friends.actionFailed')}
        </span>
      )}
    </>
  )
}

/** Cerca uno Username esatto e, se si trova, propone l'azione giusta per il rapporto. */
function SearchUser({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation()
  const online = useOnline()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<FoundUser | null | 'error' | undefined>(undefined)

  const search = (username: string) => {
    setBusy(true)
    searchUser(username).then(
      (found) => {
        setBusy(false)
        setResult(found)
      },
      () => {
        setBusy(false)
        setResult('error')
      },
    )
  }

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const username = field(new FormData(event.currentTarget), 'username').trim().replace(/^@/, '')
    if (username) search(username)
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="space-y-2">
        <label htmlFor="cerca-amico" className="text-sm font-medium">
          {t('friends.add.searchLabel')}
        </label>
        <div className="flex gap-2">
          <input
            id="cerca-amico"
            name="username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={21}
            placeholder={t('friends.add.searchPlaceholder')}
            className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-base"
          />
          <button
            type="submit"
            disabled={busy || !online}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            <Search className="size-4" aria-hidden="true" />
            {t('friends.add.search')}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">{t('friends.add.searchHint')}</p>
      </form>
      <div aria-live="polite">
        {result === null && (
          <p className="text-sm text-muted-foreground">{t('friends.add.notFound')}</p>
        )}
        {result === 'error' && (
          <p role="alert" className="text-sm text-destructive">
            {t('friends.actionFailed')}
          </p>
        )}
        {result && result !== 'error' && (
          <ul className="overflow-hidden rounded-2xl border">
            <UserRow username={result.username} hint={t(`friends.relation.${result.relation}`)}>
              {result.relation === 'nessuno' && (
                <Action
                  className={PRIMARY}
                  label={t('friends.add.send')}
                  icon={<UserPlus className="size-3.5" aria-hidden="true" />}
                  run={() => sendRequest(result.username)}
                  done={() => {
                    search(result.username)
                    onChanged()
                  }}
                  describe={t('friends.add.sendLabel', { username: result.username })}
                />
              )}
              {result.relation === 'ricevuta' && (
                <Action
                  className={PRIMARY}
                  label={t('friends.received.accept')}
                  icon={<Check className="size-3.5" aria-hidden="true" />}
                  run={() => acceptRequest(result.username)}
                  done={() => {
                    search(result.username)
                    onChanged()
                  }}
                  describe={t('friends.received.acceptLabel', { username: result.username })}
                />
              )}
            </UserRow>
          </ul>
        )}
      </div>
    </div>
  )
}

/** Il link di invito personale: si copia o si condivide; rigenerarlo invalida il vecchio. */
function InviteLink() {
  const { t } = useTranslation()
  const online = useOnline()
  const [token, setToken] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const url = token ? friendInviteUrl(token) : null

  const load = (action: () => Promise<string>) => {
    setBusy(true)
    setFailed(false)
    action().then(
      (value) => {
        setToken(value)
        setBusy(false)
        setConfirm(false)
      },
      () => {
        setBusy(false)
        setFailed(true)
      },
    )
  }

  return (
    <details
      className="border-t pt-4 text-sm"
      onToggle={(e) => {
        if (e.currentTarget.open && !token && !busy) load(inviteToken)
      }}
    >
      <summary className="cursor-pointer font-medium">{t('friends.invite.title')}</summary>
      <div className="mt-3 space-y-3">
        <p className="text-muted-foreground">{t('friends.invite.intro')}</p>
        {url && (
          <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all select-all">
            {url}
          </p>
        )}
        {busy && !url && <p className="text-muted-foreground">{t('account.loading')}</p>}
        {failed && (
          <p role="alert" className="text-destructive">
            {t('friends.actionFailed')}
          </p>
        )}
        {url && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void copyText(url).then((ok) => {
                  setCopied(ok)
                  window.setTimeout(() => {
                    setCopied(false)
                  }, 2500)
                })
              }}
              className={BUTTON}
            >
              {copied ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {copied ? t('friends.invite.copied') : t('friends.invite.copy')}
            </button>
            {canShare() && (
              <button
                type="button"
                onClick={() => {
                  void navigator
                    .share({ title: t('friends.invite.shareTitle'), url })
                    .catch(() => undefined)
                }}
                className={BUTTON}
              >
                <Share2 className="size-3.5" aria-hidden="true" />
                {t('friends.invite.send')}
              </button>
            )}
            {confirm ? (
              <>
                <button
                  type="button"
                  disabled={busy || !online}
                  onClick={() => {
                    load(regenerateInvite)
                  }}
                  className={PRIMARY}
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  {t('friends.invite.regenerateConfirm')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirm(false)
                  }}
                  className={BUTTON}
                >
                  {t('decks.cancel')}
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={!online}
                onClick={() => {
                  setConfirm(true)
                }}
                className={BUTTON}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {t('friends.invite.regenerate')}
              </button>
            )}
          </div>
        )}
        {confirm && (
          <p className="text-xs text-muted-foreground">{t('friends.invite.regenerateHint')}</p>
        )}
      </div>
    </details>
  )
}
