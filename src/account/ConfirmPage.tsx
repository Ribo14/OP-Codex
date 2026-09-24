import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { getSupabase } from '@/lib/supabase'
import { AuthLayout, FormMessage } from './form'
import { LOGIN_PATH, NEW_PASSWORD_PATH, PROFILE_PATH, RECOVER_PATH } from './paths'

// Arrivo dai link delle email (conferma dell'indirizzo e recupero password). Il link porta un
// token_hash: si verifica qui, così funziona anche aprendo l'email su un altro dispositivo.

const TYPES = ['email', 'recovery'] as const

export function ConfirmPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [rejected, setRejected] = useState(false)
  // Il token vale una volta sola: in sviluppo React esegue gli effetti due volte.
  const started = useRef(false)

  const tokenHash = params.get('token_hash')
  const rawType = params.get('type')
  const type = TYPES.find((candidate) => candidate === rawType)
  const failed = rejected || !tokenHash || !type

  useEffect(() => {
    if (started.current || !tokenHash || !type) return
    started.current = true
    const verify = async () => {
      const { error } = await getSupabase().auth.verifyOtp({ token_hash: tokenHash, type })
      if (error) setRejected(true)
      else void navigate(type === 'recovery' ? NEW_PASSWORD_PATH : PROFILE_PATH, { replace: true })
    }
    void verify()
  }, [tokenHash, type, navigate])

  return (
    <AuthLayout title={t('account.confirm.title')}>
      {failed ? (
        <>
          <FormMessage tone="error">{t('account.confirm.failed')}</FormMessage>
          <p className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link to={LOGIN_PATH} className="underline underline-offset-2">
              {t('account.confirm.toLogin')}
            </Link>
            <Link to={RECOVER_PATH} className="underline underline-offset-2">
              {t('account.confirm.toRecover')}
            </Link>
          </p>
        </>
      ) : (
        <p className="text-muted-foreground" role="status">
          {t('account.confirm.checking')}
        </p>
      )}
    </AuthLayout>
  )
}
