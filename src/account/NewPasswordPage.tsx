import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { getSupabase } from '@/lib/supabase'
import { field } from './form-data'
import { authProblem, type AuthProblem } from './errors'
import { AuthLayout, FormMessage, PasswordField, SubmitButton } from './form'
import { newPasswordProblem, PASSWORD_MIN, type PasswordProblem } from './new-password'
import { PROFILE_PATH, RECOVER_PATH } from './paths'
import { useSession } from './session'

// Dopo il link di recupero (ConfirmPage) l'utente ha una sessione e sceglie la nuova password.

export function NewPasswordPage() {
  const { t } = useTranslation()
  const session = useSession()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<AuthProblem | PasswordProblem | null>(null)

  if (session.status === 'loading') return null
  if (session.status === 'signedOut') {
    return (
      <AuthLayout title={t('account.newPassword.title')}>
        <FormMessage tone="error">{t('account.confirm.failed')}</FormMessage>
        <Link to={RECOVER_PATH} className="text-sm underline underline-offset-2">
          {t('account.confirm.toRecover')}
        </Link>
      </AuthLayout>
    )
  }

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const password = field(new FormData(event.currentTarget), 'password')
    setProblem(null)
    setBusy(true)
    const weak = await newPasswordProblem(password)
    if (weak) {
      setBusy(false)
      setProblem(weak)
      return
    }
    const { error } = await getSupabase().auth.updateUser({ password })
    setBusy(false)
    if (error) setProblem(authProblem(error))
    else void navigate(PROFILE_PATH, { replace: true, state: { passwordChanged: true } })
  }

  return (
    <AuthLayout title={t('account.newPassword.title')}>
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <PasswordField
          label={t('account.newPassword.label')}
          name="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN}
          hint={t('account.passwordRules', { min: PASSWORD_MIN })}
          required
        />
        {problem && (
          <FormMessage tone="error">
            {t(`account.problem.${problem}`, { min: PASSWORD_MIN })}
          </FormMessage>
        )}
        <SubmitButton busy={busy}>{t('account.newPassword.submit')}</SubmitButton>
      </form>
    </AuthLayout>
  )
}
