import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { getSupabase } from '@/lib/supabase'
import { field } from './form-data'
import { authProblem, type AuthProblem } from './errors'
import { AuthLayout, Field, FormMessage, SubmitButton } from './form'
import { CONFIRM_PATH, LOGIN_PATH } from './paths'
import { Turnstile } from './Turnstile'

export function RecoverPage() {
  const { t } = useTranslation()
  const [captcha, setCaptcha] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<AuthProblem | 'captchaMissing' | null>(null)
  const [sent, setSent] = useState(false)

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!captcha) {
      setProblem('captchaMissing')
      return
    }
    const email = field(new FormData(event.currentTarget), 'email')
    setBusy(true)
    setProblem(null)
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, {
      captchaToken: captcha,
      redirectTo: window.location.origin + CONFIRM_PATH,
    })
    setResetKey((k) => k + 1)
    setBusy(false)
    // Stesso messaggio che l'indirizzo sia registrato o no.
    if (error) setProblem(authProblem(error))
    else setSent(true)
  }

  return (
    <AuthLayout title={t('account.recover.title')}>
      {sent ? (
        <FormMessage tone="success">{t('account.recover.sent')}</FormMessage>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t('account.recover.intro')}</p>
          <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
            <Field
              label={t('account.email')}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
            <Turnstile onToken={setCaptcha} resetKey={resetKey} />
            {problem && <FormMessage tone="error">{t(`account.problem.${problem}`)}</FormMessage>}
            <SubmitButton busy={busy}>{t('account.recover.submit')}</SubmitButton>
          </form>
        </>
      )}
      <Link to={LOGIN_PATH} className="block text-sm underline underline-offset-2">
        {t('account.recover.back')}
      </Link>
    </AuthLayout>
  )
}
