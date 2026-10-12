import { ArrowLeft } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { FormMessage } from '@/account/form'
import {
  closeSessions,
  fetchUser,
  setSuspended,
  shortDate,
  type AdminUserDetail,
} from './admin-api'
import { adminPath } from './admin-paths'
import { UserBadges } from './AdminUsersPage'

// Dettaglio di un utente (RIB-89): qui sì l'email. Azioni: sospendere/riattivare e chiudere le
// sessioni, sempre con conferma; il database le rifiuta su se stessi e sugli altri Admin e le
// scrive nel registro. Eliminare un account o cambiare ruolo si fa solo dalla dashboard.

type Action = 'suspend' | 'reactivate' | 'sessions'

const BUTTON =
  'inline-flex h-9 items-center rounded-full border px-3 text-sm hover:bg-muted disabled:opacity-50'

export function AdminUserPage() {
  const { t } = useTranslation()
  const { userId = '' } = useParams()
  const [user, setUser] = useState<AdminUserDetail | null>(null)
  const [failed, setFailed] = useState(false)
  const [confirm, setConfirm] = useState<Action | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    let current = true
    fetchUser(userId).then(
      (data) => {
        if (current) setUser(data)
      },
      () => {
        if (current) setFailed(true)
      },
    )
    return () => {
      current = false
    }
  }, [userId])

  async function run(action: Action) {
    if (!user) return
    setBusy(true)
    setMessage(null)
    try {
      if (action === 'sessions') {
        const closed = await closeSessions(user.id)
        setMessage({ tone: 'success', text: t('admin.users.done.sessions', { count: closed }) })
      } else {
        await setSuspended(user.id, action === 'suspend')
        setMessage({ tone: 'success', text: t(`admin.users.done.${action}`) })
      }
      setUser(await fetchUser(user.id))
    } catch (error) {
      const code = (error as { message?: string }).message ?? ''
      setMessage({
        tone: 'error',
        text:
          code === 'non_su_se_stessi' || code === 'admin_protetto'
            ? t(`admin.users.problem.${code}`)
            : t('account.problem.generic'),
      })
    } finally {
      setBusy(false)
      setConfirm(null)
    }
  }

  const back = (
    <Link
      to={adminPath('users')}
      className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('admin.users.back')}
    </Link>
  )

  if (failed)
    return (
      <div className="space-y-4">
        {back}
        <FormMessage tone="error">{t('admin.users.notFound')}</FormMessage>
      </div>
    )
  if (!user) return <p className="text-muted-foreground">{t('account.loading')}</p>

  // Il database rifiuta comunque: qui si evita solo di proporre azioni impossibili.
  const manageable = !user.admin

  return (
    <section className="space-y-5" aria-labelledby="utente-titolo">
      {back}
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="utente-titolo" className="text-lg font-semibold tracking-tight">
          {user.username ? `@${user.username}` : t('admin.users.noUsername')}
        </h2>
        <UserBadges user={user} />
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-2xl border p-4 text-sm sm:grid-cols-2">
        <Field label={t('admin.users.field.email')} value={user.email ?? '—'} />
        <Field
          label={t('admin.users.field.providers')}
          value={user.providers.length > 0 ? user.providers.join(', ') : '—'}
        />
        <Field label={t('admin.users.field.created')} value={shortDate(user.created_at)} />
        <Field
          label={t('admin.users.field.lastSignIn')}
          value={user.last_sign_in_at ? shortDate(user.last_sign_in_at) : t('admin.users.never')}
        />
        <Field label={t('admin.users.field.sessions')} value={String(user.sessions)} />
        <Field
          label={t('admin.users.field.usage')}
          value={t('admin.users.usage', { decks: user.decks, copies: user.copies })}
        />
      </dl>

      {message && <FormMessage tone={message.tone}>{message.text}</FormMessage>}

      <div className="space-y-3 rounded-2xl border p-4">
        <h3 className="font-medium">{t('admin.users.actions')}</h3>
        {!manageable ? (
          <p className="text-sm text-muted-foreground">{t('admin.users.adminProtected')}</p>
        ) : confirm ? (
          <div
            role="alertdialog"
            aria-label={t(`admin.users.confirm.${confirm}`)}
            className="space-y-3"
          >
            <p className="text-sm">{t(`admin.users.confirm.${confirm}`)}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void run(confirm)
                }}
                className="inline-flex h-9 items-center rounded-full bg-destructive px-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {t(`admin.users.do.${confirm}`)}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirm(null)
                }}
                className={BUTTON}
              >
                {t('decks.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirm(user.suspended ? 'reactivate' : 'suspend')
              }}
              className={BUTTON}
            >
              {t(`admin.users.do.${user.suspended ? 'reactivate' : 'suspend'}`)}
            </button>
            <button
              type="button"
              disabled={user.sessions === 0}
              onClick={() => {
                setConfirm('sessions')
              }}
              className={BUTTON}
            >
              {t('admin.users.do.sessions')}
            </button>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t('admin.users.dashboardOnly')}</p>
      </div>
    </section>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words">{value}</dd>
    </div>
  )
}
