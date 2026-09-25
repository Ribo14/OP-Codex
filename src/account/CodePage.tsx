import { useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useSearchParams } from 'react-router'
import { getSupabase } from '@/lib/supabase'
import { CodeField, CodeMessage } from './CodeField'
import { codeProblem, type CodeProblem } from './errors'
import { AuthLayout, SubmitButton } from './form'
import { field } from './form-data'
import { cleanCode, verifiedTotp } from './mfa'
import { loginPath, RETURN_PARAM, safeReturnPath } from './return-path'
import { useSession } from './session'

// Secondo passaggio dell'accesso (RIB-18): dopo password o Google, chi ha attivato la verifica
// in due passaggi scrive il codice dell'app. Fino ad allora il database non apre i dati personali.

export function CodePage() {
  const { t } = useTranslation()
  const session = useSession()
  const [params] = useSearchParams()
  const returnTo = safeReturnPath(params.get(RETURN_PARAM))
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<CodeProblem | null>(null)

  if (session.status === 'loading') {
    return <p className="text-muted-foreground">{t('account.loading')}</p>
  }
  if (session.status === 'signedOut') return <Navigate to={loginPath(returnTo)} replace />
  if (!session.needsCode) return <Navigate to={returnTo} replace />
  const factor = verifiedTotp(session.user)

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
    // Riuscito il codice, la sessione passa ad aal2 e questa pagina rimanda a returnTo.
    const { error } = await getSupabase().auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code,
    })
    setBusy(false)
    if (error) setProblem(codeProblem(error))
  }

  return (
    <AuthLayout title={t('account.code.title')}>
      <p className="text-sm text-muted-foreground">{t('account.code.intro')}</p>
      <form onSubmit={(e) => void submit(e)} className="space-y-4" noValidate>
        <CodeField />
        {problem && <CodeMessage problem={problem} />}
        <SubmitButton busy={busy}>{t('account.code.submit')}</SubmitButton>
      </form>
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>{t('account.code.lost')}</p>
        <button
          type="button"
          onClick={() => {
            void getSupabase().auth.signOut({ scope: 'local' })
          }}
          className="text-foreground underline underline-offset-2"
        >
          {t('account.code.cancel')}
        </button>
      </div>
    </AuthLayout>
  )
}
