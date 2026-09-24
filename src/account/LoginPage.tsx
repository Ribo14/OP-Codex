import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { getSupabase } from '@/lib/supabase'
import { field } from './form-data'
import { authProblem, type AuthProblem } from './errors'
import { AuthLayout, Field, FormMessage, PasswordField, SubmitButton } from './form'
import { RECOVER_PATH, SIGNUP_PATH } from './paths'
import { RETURN_PARAM, safeReturnPath } from './return-path'
import { useSession } from './session'
import { Turnstile } from './Turnstile'

export function LoginPage() {
  const { t } = useTranslation()
  const session = useSession()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = safeReturnPath(params.get(RETURN_PARAM))
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<AuthProblem | 'captchaMissing' | null>(null)

  // Già dentro: niente da fare qui.
  if (session.status === 'signedIn' && !busy) return <Navigate to={returnTo} replace />

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!captcha) {
      setProblem('captchaMissing')
      return
    }
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setProblem(null)
    const { error } = await getSupabase().auth.signInWithPassword({
      email: field(form, 'email'),
      password: field(form, 'password'),
      options: { captchaToken: captcha },
    })
    setResetKey((k) => k + 1)
    setBusy(false)
    if (error) setProblem(authProblem(error))
    else void navigate(returnTo, { replace: true })
  }

  return (
    <AuthLayout title={t('account.login.title')}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <Field label={t('account.email')} name="email" type="email" autoComplete="email" required />
        <PasswordField
          label={t('account.password')}
          name="password"
          autoComplete="current-password"
          required
        />
        <Turnstile onToken={setCaptcha} resetKey={resetKey} />
        {problem && (
          <FormMessage tone="error">
            {problem === 'credentials'
              ? t('account.login.failed')
              : t(`account.problem.${problem}`)}
          </FormMessage>
        )}
        <SubmitButton busy={busy}>{t('account.login.submit')}</SubmitButton>
      </form>
      <div className="space-y-2 text-sm">
        <p>
          <Link to={RECOVER_PATH} className="underline underline-offset-2">
            {t('account.login.forgot')}
          </Link>
        </p>
        <p className="text-muted-foreground">
          {t('account.login.noAccount')}{' '}
          <Link to={SIGNUP_PATH} className="text-foreground underline underline-offset-2">
            {t('account.login.signupLink')}
          </Link>
        </p>
      </div>
    </AuthLayout>
  )
}
