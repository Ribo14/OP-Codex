import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Navigate } from 'react-router'
import { getSupabase } from '@/lib/supabase'
import { field } from './form-data'
import { authProblem, type AuthProblem } from './errors'
import { AuthLayout, Field, FormMessage, OrDivider, PasswordField, SubmitButton } from './form'
import { GoogleButton } from './GoogleButton'
import { CONFIRM_PATH, LOGIN_PATH, PROFILE_PATH } from './paths'
import { newPasswordProblem, PASSWORD_MIN, type PasswordProblem } from './new-password'
import { useSession } from './session'
import { Turnstile } from './Turnstile'

export function SignupPage() {
  const { t } = useTranslation()
  const session = useSession()
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<AuthProblem | PasswordProblem | 'captchaMissing' | null>(
    null,
  )
  const [sent, setSent] = useState(false)

  if (session.status === 'signedIn') return <Navigate to={PROFILE_PATH} replace />

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = field(form, 'email')
    const password = field(form, 'password')
    setProblem(null)
    setBusy(true)
    const weak = await newPasswordProblem(password)
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
    const { error } = await getSupabase().auth.signUp({
      email,
      password,
      options: {
        captchaToken: captcha,
        // Il link nell'email torna su questo sito (produzione, anteprima o locale).
        emailRedirectTo: window.location.origin + CONFIRM_PATH,
      },
    })
    setResetKey((k) => k + 1)
    setBusy(false)
    // Stessa risposta per indirizzi nuovi o già registrati: Supabase non lo rivela e noi nemmeno.
    if (error) setProblem(authProblem(error))
    else setSent(true)
  }

  if (sent) {
    return (
      <AuthLayout title={t('account.signup.sentTitle')}>
        <FormMessage tone="success">{t('account.signup.sent')}</FormMessage>
        <p className="text-sm text-muted-foreground">{t('account.signup.sentHint')}</p>
        <Link to={LOGIN_PATH} className="text-sm underline underline-offset-2">
          {t('account.signup.toLogin')}
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('account.signup.title')}>
      <p className="text-sm text-muted-foreground">{t('account.signup.intro')}</p>
      <GoogleButton returnTo={PROFILE_PATH} />
      <OrDivider />
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <Field label={t('account.email')} name="email" type="email" autoComplete="email" required />
        <PasswordField
          label={t('account.password')}
          name="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          hint={t('account.passwordRules', { min: PASSWORD_MIN })}
          required
        />
        <Turnstile onToken={setCaptcha} resetKey={resetKey} />
        {problem && (
          <FormMessage tone="error">
            {t(`account.problem.${problem}`, { min: PASSWORD_MIN })}
          </FormMessage>
        )}
        <SubmitButton busy={busy}>{t('account.signup.submit')}</SubmitButton>
      </form>
      <p className="text-sm text-muted-foreground">
        {t('account.signup.haveAccount')}{' '}
        <Link to={LOGIN_PATH} className="text-foreground underline underline-offset-2">
          {t('account.signup.loginLink')}
        </Link>
      </p>
    </AuthLayout>
  )
}
