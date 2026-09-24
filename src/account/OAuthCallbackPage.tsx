import { useTranslation } from 'react-i18next'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router'
import { AuthLayout, FormMessage } from './form'
import { LOGIN_PATH } from './paths'
import { RETURN_PARAM, safeReturnPath } from './return-path'
import { useSession } from './session'

// Ritorno da Google (RIB-17). Il client Supabase, all'avvio della pagina, scambia da solo il
// codice dell'indirizzo con la sessione (flusso PKCE, src/lib/supabase.ts); qui si aspetta la
// sessione e si torna alla pagina di partenza. UsernameGate chiede lo Username se manca.

export function OAuthCallbackPage() {
  const { t } = useTranslation()
  const session = useSession()
  const [params] = useSearchParams()
  const { hash } = useLocation()
  const returnTo = safeReturnPath(params.get(RETURN_PARAM))
  // Google o Supabase segnalano gli errori (es. accesso annullato) nella query o nell'hash.
  const failed = params.has('error') || new URLSearchParams(hash.slice(1)).has('error')

  if (!failed && session.status === 'signedIn') return <Navigate to={returnTo} replace />
  if (!failed && session.status === 'loading') {
    return (
      <AuthLayout title={t('account.google.title')}>
        <p role="status" className="text-muted-foreground">
          {t('account.google.checking')}
        </p>
      </AuthLayout>
    )
  }
  return (
    <AuthLayout title={t('account.google.title')}>
      <FormMessage tone="error">{t('account.google.failed')}</FormMessage>
      <Link
        to={`${LOGIN_PATH}?${new URLSearchParams({ [RETURN_PARAM]: returnTo }).toString()}`}
        className="text-sm underline underline-offset-2"
      >
        {t('account.confirm.toLogin')}
      </Link>
    </AuthLayout>
  )
}
