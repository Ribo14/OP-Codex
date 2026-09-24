import type { User } from '@supabase/supabase-js'
import { LogOut } from 'lucide-react'
import { useState, type SubmitEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { getSupabase } from '@/lib/supabase'
import { field } from './form-data'
import { authProblem, type AuthProblem } from './errors'
import { Field, FormMessage, PasswordField, SubmitButton } from './form'
import { newPasswordProblem, PASSWORD_MIN, type PasswordProblem } from './new-password'
import { loginPath, RETURN_PARAM, safeReturnPath } from './return-path'
import { useProfile, useSession, type Profile } from './session'
import { Turnstile } from './Turnstile'
import { USERNAME_MAX, USERNAME_MIN, usernameProblem, type UsernameProblem } from './username'

/**
 * Le parti dell'app che richiedono l'account: senza sessione si va all'accesso (e poi si torna
 * qui); al primo accesso si sceglie lo Username prima di proseguire.
 */
export function RequireAccount({
  children,
}: {
  children: (account: { user: User; profile: Profile }) => ReactNode
}) {
  const { t } = useTranslation()
  const session = useSession()
  const location = useLocation()

  if (session.status === 'loading') {
    return <p className="text-muted-foreground">{t('account.loading')}</p>
  }
  if (session.status === 'signedOut') {
    return <Navigate to={loginPath(location.pathname + location.search)} replace />
  }
  return <WithProfile user={session.user}>{children}</WithProfile>
}

function WithProfile({
  user,
  children,
}: {
  user: User
  children: (account: { user: User; profile: Profile }) => ReactNode
}) {
  const { t } = useTranslation()
  const { profile, reload } = useProfile(user.id)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Arrivati qui dal controllo della shell (UsernameGate): scelto lo Username si torna indietro.
  const returnTo = params.get(RETURN_PARAM)
  const done = async () => {
    await reload()
    if (returnTo) void navigate(safeReturnPath(returnTo), { replace: true })
  }
  if (profile.status === 'loading') {
    return <p className="text-muted-foreground">{t('account.loading')}</p>
  }
  if (profile.status === 'error') {
    // Anche senza profilo leggibile si deve poter uscire.
    return (
      <div className="mx-auto w-full max-w-sm space-y-4 py-4">
        <FormMessage tone="error">{t('account.problem.generic')}</FormMessage>
        <LogoutButton />
      </div>
    )
  }
  if (profile.status === 'missing') return <UsernameForm userId={user.id} onDone={done} />
  return <>{children({ user, profile: profile.profile })}</>
}

function UsernameForm({ userId, onDone }: { userId: string; onDone: () => Promise<void> }) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<UsernameProblem | 'taken' | 'generic' | null>(null)

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const username = field(new FormData(event.currentTarget), 'username').trim()
    const invalid = usernameProblem(username)
    if (invalid) {
      setProblem(invalid)
      return
    }
    setBusy(true)
    setProblem(null)
    const { error } = await getSupabase().from('profiles').insert({ id: userId, username })
    setBusy(false)
    // 23505: già in uso (anche con maiuscole diverse); 23514: regole del database.
    if (error)
      setProblem(
        error.code === '23505' ? 'taken' : error.code === '23514' ? 'characters' : 'generic',
      )
    else await onDone()
  }

  return (
    <section className="mx-auto w-full max-w-sm space-y-6 py-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">{t('account.username.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('account.username.intro')}</p>
      </div>
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <Field
          label={t('account.username.label')}
          name="username"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          minLength={USERNAME_MIN}
          maxLength={USERNAME_MAX}
          hint={t('account.username.rules', { min: USERNAME_MIN, max: USERNAME_MAX })}
          required
        />
        {problem && (
          <FormMessage tone="error">
            {t(`account.username.problem.${problem}`, { min: USERNAME_MIN, max: USERNAME_MAX })}
          </FormMessage>
        )}
        <SubmitButton busy={busy}>{t('account.username.submit')}</SubmitButton>
      </form>
    </section>
  )
}

export function ProfilePage() {
  const { t } = useTranslation()
  const location = useLocation()
  const passwordChanged =
    (location.state as { passwordChanged?: boolean } | null)?.passwordChanged === true

  return (
    <RequireAccount>
      {({ user, profile }) => (
        <div className="mx-auto max-w-2xl space-y-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">
              @{profile.username}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
          </div>
          {passwordChanged && (
            <FormMessage tone="success">{t('account.changePassword.done')}</FormMessage>
          )}
          <section className="space-y-3 rounded-2xl border p-5">
            <h2 className="text-lg font-semibold tracking-tight">
              {t('account.changePassword.title')}
            </h2>
            <ChangePasswordForm email={user.email ?? ''} />
          </section>
          <LogoutButton />
        </div>
      )}
    </RequireAccount>
  )
}

function LogoutButton() {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={() => {
        // Solo questo dispositivo; "esci ovunque" arriverà con RIB-18.
        void getSupabase().auth.signOut({ scope: 'local' })
      }}
      className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium hover:bg-muted"
    >
      <LogOut className="size-4" aria-hidden="true" />
      {t('account.logout')}
    </button>
  )
}

/** Cambio password: serve quella attuale (verificata con un nuovo accesso, con CAPTCHA). */
function ChangePasswordForm({ email }: { email: string }) {
  const { t } = useTranslation()
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<
    AuthProblem | PasswordProblem | 'captchaMissing' | 'current' | null
  >(null)
  const [done, setDone] = useState(false)

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const current = field(form, 'current')
    const next = field(form, 'next')
    setProblem(null)
    setDone(false)
    setBusy(true)
    const weak = await newPasswordProblem(next)
    if (weak) {
      setBusy(false)
      setProblem(weak)
      return
    }
    if (!captcha) {
      setBusy(false)
      setProblem('captchaMissing')
      return
    }
    const auth = getSupabase().auth
    const check = await auth.signInWithPassword({
      email,
      password: current,
      options: { captchaToken: captcha },
    })
    setResetKey((k) => k + 1)
    if (check.error) {
      setBusy(false)
      const reason = authProblem(check.error)
      setProblem(reason === 'credentials' ? 'current' : reason)
      return
    }
    const { error } = await auth.updateUser({ password: next })
    setBusy(false)
    if (error) {
      setProblem(authProblem(error))
      return
    }
    formElement.reset()
    setDone(true)
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="max-w-sm space-y-4" noValidate>
      <PasswordField
        label={t('account.changePassword.current')}
        name="current"
        autoComplete="current-password"
        required
      />
      <PasswordField
        label={t('account.changePassword.next')}
        name="next"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        hint={t('account.passwordRules', { min: PASSWORD_MIN })}
        required
      />
      <Turnstile onToken={setCaptcha} resetKey={resetKey} />
      {problem && (
        <FormMessage tone="error">
          {problem === 'current'
            ? t('account.changePassword.wrongCurrent')
            : t(`account.problem.${problem}`, { min: PASSWORD_MIN })}
        </FormMessage>
      )}
      {done && <FormMessage tone="success">{t('account.changePassword.done')}</FormMessage>}
      <SubmitButton busy={busy}>{t('account.changePassword.submit')}</SubmitButton>
    </form>
  )
}
