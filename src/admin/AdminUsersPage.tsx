import { ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { FormMessage } from '@/account/form'
import { SearchField } from '@/components/SearchField'
import { cn } from '@/lib/utils'
import { fetchUsers, filterUsers, shortDate, type AdminUser } from './admin-api'
import { adminUserPath } from './admin-paths'

// Scheda "Utenti" (RIB-89): chi si è iscritto, quando ha fatto l'ultimo accesso, quanto usa
// l'app. L'email non si vede qui, solo nel dettaglio di un utente.

export function AdminUsersPage() {
  const { t } = useTranslation()
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let current = true
    fetchUsers().then(
      (data) => {
        if (current) setUsers(data)
      },
      () => {
        if (current) setFailed(true)
      },
    )
    return () => {
      current = false
    }
  }, [])

  if (failed) return <FormMessage tone="error">{t('account.problem.generic')}</FormMessage>
  if (!users) return <p className="text-muted-foreground">{t('account.loading')}</p>

  const shown = filterUsers(users, query)
  return (
    <section className="space-y-4" aria-labelledby="utenti-titolo">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="utenti-titolo" className="text-lg font-semibold tracking-tight">
          {t('admin.users.title')}
        </h2>
        <span className="text-sm text-muted-foreground">
          {t('admin.users.count', { count: users.length })}
        </span>
      </div>
      <SearchField
        value={query}
        onChange={setQuery}
        label={t('admin.users.search')}
        className="sm:max-w-sm"
      />
      {shown.length === 0 ? (
        <p className="text-muted-foreground">{t('admin.users.empty')}</p>
      ) : (
        <ul className="divide-y rounded-2xl border">
          {shown.map((user) => (
            <li key={user.id}>
              <UserRow user={user} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function UserRow({ user }: { user: AdminUser }) {
  const { t } = useTranslation()
  return (
    <Link
      to={adminUserPath(user.id)}
      className="flex items-center gap-3 px-4 py-3 hover:bg-muted/60"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-medium">
            {user.username ? `@${user.username}` : t('admin.users.noUsername')}
          </span>
          <UserBadges user={user} />
        </div>
        <p className="text-xs text-muted-foreground">
          {t('admin.users.summary', {
            created: shortDate(user.created_at),
            lastSignIn: user.last_sign_in_at
              ? shortDate(user.last_sign_in_at)
              : t('admin.users.never'),
            decks: user.decks,
            copies: user.copies,
          })}
        </p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}

export function UserBadges({ user }: { user: Pick<AdminUser, 'admin' | 'mfa' | 'suspended'> }) {
  const { t } = useTranslation()
  return (
    <>
      {user.suspended && <Badge tone="danger">{t('admin.users.badge.suspended')}</Badge>}
      {user.admin && <Badge>{t('admin.users.badge.admin')}</Badge>}
      {user.mfa && <Badge tone="ok">{t('admin.users.badge.mfa')}</Badge>}
    </>
  )
}

function Badge({
  children,
  tone = 'neutral',
}: {
  children: string
  tone?: 'neutral' | 'ok' | 'danger'
}) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-medium',
        tone === 'neutral' && 'bg-muted text-foreground',
        tone === 'ok' && 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400',
        tone === 'danger' && 'bg-destructive/10 text-destructive',
      )}
    >
      {children}
    </span>
  )
}
