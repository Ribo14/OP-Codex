import { ShieldAlert } from 'lucide-react'
import { useEffect, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet } from 'react-router'
import { CodeField, CodeMessage } from '@/account/CodeField'
import { codeProblem, type CodeProblem } from '@/account/errors'
import { FormMessage, SubmitButton } from '@/account/form'
import { field } from '@/account/form-data'
import { cleanCode, verifiedTotp } from '@/account/mfa'
import { PROFILE_PATH } from '@/account/paths'
import { RequireAccount } from '@/account/ProfilePage'
import { useSession } from '@/account/session'
import { getSupabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { ADMIN_TABS, adminPath } from './admin-paths'

// Area Admin (RIB-19, ADR-0014). Il database decide chi entra (private.admin_attivo): Admin,
// sessione valida e codice della verifica in due passaggi. Qui si mostra solo il risultato.
// RIB-89: una panoramica e una scheda per ogni area, ognuna col suo indirizzo.
// RIB-98: il codice vale 12 ore; poi il database risponde "rinnova" e lo si chiede qui.

type AdminState = 'loading' | 'no' | 'codice' | 'rinnova' | 'ok' | 'error'
const STATES: readonly AdminState[] = ['no', 'codice', 'rinnova', 'ok']

export function AdminPage() {
  return <RequireAccount>{() => <AdminArea />}</RequireAccount>
}

function AdminArea() {
  const { t } = useTranslation()
  const [state, setState] = useState<AdminState>('loading')
  const [check, setCheck] = useState(0)

  useEffect(() => {
    let current = true
    void getSupabase()
      .rpc('stato_admin')
      .then(({ data, error }) => {
        if (!current) return
        setState(error ? 'error' : (STATES.find((s) => s === data) ?? 'no'))
      })
    return () => {
      current = false
    }
  }, [check])

  if (state === 'loading') return <p className="text-muted-foreground">{t('account.loading')}</p>
  if (state === 'error')
    return <FormMessage tone="error">{t('account.problem.generic')}</FormMessage>
  if (state === 'no') {
    return (
      <section className="mx-auto max-w-2xl space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin.title')}</h1>
        <p className="text-muted-foreground">{t('admin.notAdmin')}</p>
      </section>
    )
  }
  if (state === 'codice') {
    return (
      <section className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t('admin.title')}</h1>
        <div className="flex gap-3 rounded-2xl border p-5">
          <ShieldAlert className="size-5 shrink-0" aria-hidden="true" />
          <div className="space-y-2 text-sm">
            <p>{t('admin.needsTwoFactor')}</p>
            <Link to={PROFILE_PATH} className="underline underline-offset-2">
              {t('admin.toProfile')}
            </Link>
          </div>
        </div>
      </section>
    )
  }
  if (state === 'rinnova') {
    return (
      <RenewCode
        onDone={() => {
          setState('loading')
          setCheck((c) => c + 1)
        }}
      />
    )
  }
  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{t('admin.title')}</h1>
      <nav
        aria-label={t('admin.tabs.label')}
        className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      >
        <ul className="flex w-max gap-1 rounded-full bg-muted p-1 text-sm">
          {ADMIN_TABS.map((tab) => (
            <li key={tab.key}>
              <NavLink
                to={adminPath(tab.key)}
                end={tab.key === 'overview'}
                className={({ isActive }) =>
                  cn(
                    'inline-flex h-9 items-center rounded-full px-4 whitespace-nowrap',
                    isActive
                      ? 'bg-background font-medium shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                {t(`admin.tabs.${tab.key}`)}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <Outlet />
    </div>
  )
}

/** Codice scaduto (più di 12 ore): lo si rinnova senza uscire dall'area. */
function RenewCode({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const session = useSession()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<CodeProblem | null>(null)
  const factor = session.status === 'signedIn' ? verifiedTotp(session.user) : undefined

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = cleanCode(field(new FormData(event.currentTarget), 'code'))
    if (!code) {
      setProblem('format')
      return
    }
    if (!factor) return
    setBusy(true)
    setProblem(null)
    const { error } = await getSupabase().auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    })
    setBusy(false)
    if (error) setProblem(codeProblem(error))
    else onDone()
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t('admin.title')}</h1>
      <p className="text-sm text-muted-foreground">{t('admin.renewCode')}</p>
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <CodeField />
        {problem && <CodeMessage problem={problem} />}
        <SubmitButton busy={busy}>{t('account.code.submit')}</SubmitButton>
      </form>
    </section>
  )
}
