import type { Factor } from '@supabase/supabase-js'
import { LogOut, ShieldCheck, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { getSupabase } from '@/lib/supabase'
import { CodeField, CodeMessage } from './CodeField'
import {
  authProblem,
  codeProblem,
  deleteProblem,
  type CodeProblem,
  type DeleteProblem,
} from './errors'
import { Field, FormMessage } from './form'
import { field } from './form-data'
import { cleanCode, qrSource } from './mfa'
import { PROFILE_PATH } from './paths'

// "Account e sicurezza" nel Profilo (RIB-18, ADR-0013): verifica in due passaggi, uscita da
// tutti i dispositivi, eliminazione dell'account.

export function SecuritySection({ username }: { username: string }) {
  const { t } = useTranslation()
  return (
    <section className="space-y-4" aria-labelledby="sicurezza-titolo">
      <h2 id="sicurezza-titolo" className="text-lg font-semibold tracking-tight">
        {t('account.security.title')}
      </h2>
      <Card title={t('account.twoFactor.title')}>
        <TwoFactor />
      </Card>
      <Card title={t('account.logoutEverywhere.title')}>
        <LogoutEverywhere />
      </Card>
      <Card title={t('account.delete.title')} danger>
        <DeleteAccount username={username} />
      </Card>
    </section>
  )
}

function Card({
  title,
  danger = false,
  children,
}: {
  title: string
  danger?: boolean
  children: ReactNode
}) {
  return (
    <div
      className={
        danger
          ? 'space-y-3 rounded-2xl border border-destructive/40 p-5'
          : 'space-y-3 rounded-2xl border p-5'
      }
    >
      <h3 className="font-semibold">{title}</h3>
      {children}
    </div>
  )
}

const BUTTON =
  'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50'
const PRIMARY =
  'inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50'

interface Setup {
  factorId: string
  qr: string
  secret: string
}

type ActiveFactor = { factor: Factor | null } | { problem: CodeProblem }

/** Il fattore TOTP confermato, letto dal server (la sessione potrebbe non essere aggiornata). */
async function readActiveFactor(): Promise<ActiveFactor> {
  const { data, error } = await getSupabase().auth.mfa.listFactors()
  if (error) return { problem: authProblem(error) }
  return {
    factor: data.all.find((f) => f.factor_type === 'totp' && f.status === 'verified') ?? null,
  }
}

/** Attivazione (QR code + primo codice) e disattivazione (con un codice) della verifica. */
function TwoFactor() {
  const { t } = useTranslation()
  // undefined = ancora da leggere; null = non attiva.
  const [active, setActive] = useState<Factor | null | undefined>(undefined)
  const [setup, setSetup] = useState<Setup | null>(null)
  const [disabling, setDisabling] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<CodeProblem | null>(null)
  const [done, setDone] = useState<'enabled' | 'disabled' | null>(null)

  const show = useCallback((read: ActiveFactor) => {
    if ('problem' in read) setProblem(read.problem)
    setActive('problem' in read ? null : read.factor)
  }, [])

  const load = async () => {
    show(await readActiveFactor())
  }

  useEffect(() => {
    let current = true
    void readActiveFactor().then((read) => {
      if (current) show(read)
    })
    return () => {
      current = false
    }
  }, [show])

  const start = async () => {
    const mfa = getSupabase().auth.mfa
    setBusy(true)
    setProblem(null)
    setDone(null)
    // Un'attivazione lasciata a metà occupa il nome: la si toglie prima di ricominciare.
    const listed = await mfa.listFactors()
    for (const f of listed.data?.all ?? []) {
      if (f.factor_type === 'totp' && f.status === 'unverified')
        await mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await mfa.enroll({
      factorType: 'totp',
      issuer: 'OP-Codex',
      friendlyName: 'OP-Codex',
    })
    setBusy(false)
    if (error) {
      setProblem(authProblem(error))
      return
    }
    setSetup({ factorId: data.id, qr: qrSource(data.totp.qr_code), secret: data.totp.secret })
  }

  const cancel = async () => {
    if (setup) await getSupabase().auth.mfa.unenroll({ factorId: setup.factorId })
    setSetup(null)
    setDisabling(false)
    setProblem(null)
  }

  /** Conferma con il codice: attiva il fattore nuovo, oppure autorizza a togliere quello attivo. */
  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = cleanCode(field(new FormData(event.currentTarget), 'code'))
    if (!code) {
      setProblem('format')
      return
    }
    const factorId = setup?.factorId ?? active?.id
    if (!factorId) return
    const auth = getSupabase().auth
    setBusy(true)
    setProblem(null)
    const verified = await auth.mfa.challengeAndVerify({ factorId, code })
    if (verified.error) {
      setBusy(false)
      setProblem(codeProblem(verified.error))
      return
    }
    if (!setup) {
      const removed = await auth.mfa.unenroll({ factorId })
      if (removed.error) {
        setBusy(false)
        setProblem(authProblem(removed.error))
        return
      }
    }
    // Aggiorna i fattori nella sessione (serve a sapere quando chiedere il codice).
    await auth.refreshSession()
    setBusy(false)
    setDone(setup ? 'enabled' : 'disabled')
    setSetup(null)
    setDisabling(false)
    await load()
  }

  if (active === undefined)
    return <p className="text-sm text-muted-foreground">{t('account.loading')}</p>

  const codeForm = (submitLabel: string) => (
    <form onSubmit={(e) => void submit(e)} className="max-w-sm space-y-4" noValidate>
      <CodeField />
      {problem && <CodeMessage problem={problem} />}
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={busy} aria-busy={busy} className={PRIMARY}>
          {submitLabel}
        </button>
        <button type="button" onClick={() => void cancel()} className={BUTTON}>
          {t('account.twoFactor.cancel')}
        </button>
      </div>
    </form>
  )

  if (setup) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('account.twoFactor.scan')}</p>
        <img
          src={setup.qr}
          alt={t('account.twoFactor.qrAlt')}
          width={180}
          height={180}
          className="rounded-xl bg-white p-2"
        />
        <div className="space-y-1 text-sm">
          <p className="text-muted-foreground">{t('account.twoFactor.manual')}</p>
          <code className="block rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all select-all">
            {setup.secret}
          </code>
        </div>
        {codeForm(t('account.twoFactor.confirm'))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {active ? t('account.twoFactor.on') : t('account.twoFactor.off')}
      </p>
      {done && <FormMessage tone="success">{t(`account.twoFactor.done.${done}`)}</FormMessage>}
      {active ? (
        disabling ? (
          codeForm(t('account.twoFactor.disable'))
        ) : (
          <button
            type="button"
            onClick={() => {
              setDisabling(true)
              setDone(null)
            }}
            className={BUTTON}
          >
            {t('account.twoFactor.disable')}
          </button>
        )
      ) : (
        <>
          {problem && <CodeMessage problem={problem} />}
          <button type="button" disabled={busy} onClick={() => void start()} className={BUTTON}>
            <ShieldCheck className="size-4" aria-hidden="true" />
            {t('account.twoFactor.enable')}
          </button>
        </>
      )}
    </div>
  )
}

/** Chiude tutte le sessioni, compresa questa: il database smette subito di accettarle. */
function LogoutEverywhere() {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('account.logoutEverywhere.intro')}</p>
      {failed && <FormMessage tone="error">{t('account.problem.generic')}</FormMessage>}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true)
          setFailed(false)
          void getSupabase()
            .auth.signOut({ scope: 'global' })
            .then(({ error }) => {
              setBusy(false)
              if (error) setFailed(true)
            })
        }}
        className={BUTTON}
      >
        <LogOut className="size-4" aria-hidden="true" />
        {t('account.logoutEverywhere.submit')}
      </button>
    </div>
  )
}

/** Eliminazione definitiva: Username come conferma, accesso degli ultimi 10 minuti. */
function DeleteAccount({ username }: { username: string }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<DeleteProblem | null>(null)

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const confirmation = field(new FormData(event.currentTarget), 'confirm').trim()
    setBusy(true)
    setProblem(null)
    const supabase = getSupabase()
    const { error } = await supabase.rpc('elimina_account', { conferma_username: confirmation })
    if (error) {
      setBusy(false)
      setProblem(deleteProblem(error))
      return
    }
    // L'account non esiste più: si mostra la conferma e si chiude la sessione di questo browser.
    await navigate(PROFILE_PATH, { replace: true, state: { accountDeleted: true } })
    await supabase.auth.signOut({ scope: 'local' })
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('account.delete.intro')}</p>
      <form onSubmit={(e) => void submit(e)} className="max-w-sm space-y-4" noValidate>
        <Field
          label={t('account.delete.confirmLabel', { username })}
          name="confirm"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        {problem === 'reauth' ? (
          <div className="space-y-2">
            <FormMessage tone="error">{t('account.delete.problem.reauth')}</FormMessage>
            <button
              type="button"
              onClick={() => {
                // Uscendo, il Profilo rimanda all'accesso e poi di nuovo qui.
                void getSupabase().auth.signOut({ scope: 'local' })
              }}
              className={BUTTON}
            >
              {t('account.delete.reauth')}
            </button>
          </div>
        ) : (
          problem && (
            <FormMessage tone="error">{t(`account.delete.problem.${problem}`)}</FormMessage>
          )
        )}
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-destructive px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {t('account.delete.submit')}
        </button>
      </form>
    </div>
  )
}
