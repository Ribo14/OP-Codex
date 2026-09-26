import { Flag, MessageSquarePlus } from 'lucide-react'
import { useEffect, useId, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FormMessage } from '@/account/form'
import { useSession } from '@/account/session'
import { useOnline } from '@/lib/use-online'
import type { CatalogCard } from './catalog-data'
import {
  loadMyReports,
  NOTE_MAX,
  REPORT_REASONS,
  sendReport,
  type MyReport,
  type ReportKind,
  type ReportReason,
  type SendProblem,
} from './explanation-reports'

// Nel dettaglio Card, per chi ha l'accesso (RIB-54): "Segnala un problema" sotto una spiegazione,
// "Chiedi una spiegazione" per una carta con effetto che non ce l'ha. Le voci vanno nella coda
// dell'Admin; qui si vede anche lo stato delle proprie.

const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50'

export function ExplanationFeedback({ card }: { card: CatalogCard }) {
  const session = useSession()
  if (session.status !== 'signedIn') return null
  const hasExplanation = Boolean(card.explanation)
  // Le carte senza effetto non hanno bisogno di spiegazioni.
  if (!hasExplanation && card.effect === null && card.trigger === null) return null
  return (
    <Feedback
      key={card.cardCode}
      cardCode={card.cardCode}
      kind={hasExplanation ? 'report' : 'request'}
    />
  )
}

function Feedback({ cardCode, kind }: { cardCode: string; kind: ReportKind }) {
  const { t } = useTranslation()
  const online = useOnline()
  const [mine, setMine] = useState<MyReport[] | null>(null)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<SendProblem | null>(null)
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (!online) return
    let current = true
    loadMyReports(cardCode).then(
      (list) => {
        if (current) setMine(list)
      },
      () => {
        if (current) setMine([])
      },
    )
    return () => {
      current = false
    }
  }, [cardCode, online, sent])

  const pending = mine?.find(
    (r) => r.kind === kind && (r.status === 'open' || r.status === 'in_progress'),
  )
  const last = mine?.find((r) => r.kind === kind)

  const send = async (reason: ReportReason | null, note: string) => {
    setBusy(true)
    setProblem(null)
    const result = await sendReport({ cardCode, kind, reason, note })
    setBusy(false)
    if (result) {
      setProblem(result)
      return
    }
    setOpen(false)
    setSent(true)
  }

  return (
    <div className="space-y-2">
      {kind === 'request' && (
        <p className="text-sm text-muted-foreground">{t('detail.feedback.noExplanation')}</p>
      )}
      {sent && <FormMessage tone="success">{t(`detail.feedback.sent.${kind}`)}</FormMessage>}
      {pending ? (
        <p className="text-xs text-muted-foreground">
          {t(`detail.feedback.pending.${kind}`, {
            status: t(`detail.feedback.status.${pending.status}`),
          })}
        </p>
      ) : (
        <>
          {!sent && last && (
            <p className="text-xs text-muted-foreground">
              {t(`detail.feedback.last.${kind}`, {
                status: t(`detail.feedback.status.${last.status}`),
              })}
            </p>
          )}
          {open && kind === 'report' ? (
            <ReportForm
              busy={busy}
              onSend={(reason, note) => void send(reason, note)}
              onCancel={() => {
                setOpen(false)
                setProblem(null)
              }}
            />
          ) : (
            <button
              type="button"
              disabled={busy || !online || mine === null}
              onClick={() => {
                if (kind === 'request') void send(null, '')
                else setOpen(true)
              }}
              className={BUTTON}
            >
              {kind === 'report' ? (
                <Flag className="size-3.5" aria-hidden="true" />
              ) : (
                <MessageSquarePlus className="size-3.5" aria-hidden="true" />
              )}
              {t(`detail.feedback.action.${kind}`)}
            </button>
          )}
        </>
      )}
      {!online && <p className="text-xs text-muted-foreground">{t('detail.feedback.offline')}</p>}
      {problem && <FormMessage tone="error">{t(`detail.feedback.problem.${problem}`)}</FormMessage>}
    </div>
  )
}

function ReportForm({
  busy,
  onSend,
  onCancel,
}: {
  busy: boolean
  onSend: (reason: ReportReason, note: string) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [reason, setReason] = useState<ReportReason>('wrong')
  const [note, setNote] = useState('')

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    onSend(reason, note)
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border p-4">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('detail.feedback.reasonLabel')}</legend>
        {REPORT_REASONS.map((value) => (
          <label key={value} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={`${id}-motivo`}
              value={value}
              checked={reason === value}
              onChange={() => {
                setReason(value)
              }}
              className="size-4 accent-foreground"
            />
            {t(`detail.feedback.reason.${value}`)}
          </label>
        ))}
      </fieldset>
      <label className="block space-y-1 text-sm">
        <span className="font-medium">{t('detail.feedback.noteLabel')}</span>
        <textarea
          value={note}
          maxLength={NOTE_MAX}
          rows={3}
          onChange={(e) => {
            setNote(e.target.value)
          }}
          className="w-full rounded-xl border bg-background px-3 py-2 text-base"
        />
        <span className="text-xs text-muted-foreground">
          {t('detail.feedback.noteHint', { count: NOTE_MAX - note.length })}
        </span>
      </label>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          aria-busy={busy}
          className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-xs font-medium text-background disabled:opacity-50"
        >
          {t('detail.feedback.send')}
        </button>
        <button type="button" onClick={onCancel} className={BUTTON}>
          {t('detail.feedback.cancel')}
        </button>
      </div>
    </form>
  )
}
