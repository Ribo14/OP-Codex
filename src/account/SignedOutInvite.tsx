import { LogIn } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { SIGNUP_PATH } from './paths'
import { loginPath } from './return-path'

/**
 * Per le sezioni che richiedono l'account aperte senza accesso (es. da un link): un invito con
 * Accedi e Registrati, invece di un rimando immediato all'accesso.
 */
export function SignedOutInvite({ text, returnTo }: { text: string; returnTo: string }) {
  const { t } = useTranslation()
  return (
    <div className="max-w-md space-y-3 rounded-2xl border p-5">
      <p>{text}</p>
      <div className="flex flex-wrap gap-2">
        <Link
          to={loginPath(returnTo)}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background"
        >
          <LogIn className="size-4" aria-hidden="true" />
          {t('nav.login')}
        </Link>
        <Link
          to={SIGNUP_PATH}
          className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium hover:bg-muted"
        >
          {t('account.login.signupLink')}
        </Link>
      </div>
    </div>
  )
}
