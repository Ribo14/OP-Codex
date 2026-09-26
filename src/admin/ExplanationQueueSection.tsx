import { Copy, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FormMessage } from '@/account/form'
import { useCatalog } from '@/catalog/local-catalog'
import { getSupabase } from '@/lib/supabase'
import { groupQueue, queueAsText, type QueueItem, type QueueRow } from './explanation-queue'

// Area Admin, coda delle segnalazioni e richieste di spiegazione (RIB-54). Le spiegazioni si
// scrivono nelle sessioni di sviluppo (ADR-0006): qui si vede cosa c'è da fare, si copia l'elenco
// da passare alla sessione e si chiudono le voci. Il database accetta i cambi di stato solo
// dall'Admin attivo e li registra.

const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50'
const NEXT_STATUS = ['in_progress', 'resolved', 'dismissed'] as const

export function ExplanationQueueSection() {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const [items, setItems] = useState<QueueItem[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const nameOf = (code: string) => catalog?.cards.find((c) => c.cardCode === code)?.name ?? ''

  const read = useCallback(async (): Promise<QueueRow[] | null> => {
    const { data, error } = await getSupabase()
      .from('explanation_reports')
      .select('id, card_code, kind, reason, note, status, created_at')
      .in('status', ['open', 'in_progress'])
      .order('created_at')
      .limit(500)
    return error ? null : data
  }, [])

  const show = useCallback((rows: QueueRow[] | null) => {
    setFailed(rows === null)
    setItems(groupQueue(rows ?? []))
  }, [])

  useEffect(() => {
    let current = true
    void read().then((rows) => {
      if (current) show(rows)
    })
    return () => {
      current = false
    }
  }, [read, show])

  const setStatus = async (item: QueueItem, status: (typeof NEXT_STATUS)[number]) => {
    const { error } = await getSupabase()
      .from('explanation_reports')
      .update({ status })
      .in('id', item.ids)
    if (error) setFailed(true)
    else show(await read())
  }

  return (
    <section className="space-y-4" aria-labelledby="coda-titolo">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="coda-titolo" className="text-lg font-semibold tracking-tight">
          {t('admin.queue.title')}
        </h2>
        <div className="ml-auto flex gap-2">
          {items && items.length > 0 && (
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(queueAsText(items, nameOf)).then(() => {
                  setCopied(true)
                })
              }}
              className={BUTTON}
            >
              <Copy className="size-3.5" aria-hidden="true" />
              {copied ? t('admin.queue.copied') : t('admin.queue.copy')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setItems(null)
              setCopied(false)
              void read().then(show)
            }}
            className={BUTTON}
          >
            <RefreshCw className="size-3.5" aria-hidden="true" />
            {t('admin.jobs.reload')}
          </button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{t('admin.queue.intro')}</p>
      {failed && <FormMessage tone="error">{t('account.problem.generic')}</FormMessage>}
      {items === null ? (
        <p className="text-muted-foreground">{t('account.loading')}</p>
      ) : items.length === 0 ? (
        !failed && <p className="text-muted-foreground">{t('admin.queue.empty')}</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={`${item.cardCode}-${item.kind}`} className="space-y-2 rounded-2xl border p-4">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-medium">
                  {item.cardCode} · {nameOf(item.cardCode)}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                  {t(`admin.queue.kind.${item.kind}`, { count: item.ids.length })}
                </span>
                {item.status === 'in_progress' && (
                  <span className="text-xs text-muted-foreground">
                    {t('detail.feedback.status.in_progress')}
                  </span>
                )}
              </div>
              {Object.keys(item.reasons).length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {Object.entries(item.reasons)
                    .map(
                      ([reason, count]) =>
                        `${t(`detail.feedback.reason.${reason as 'wrong'}`)} ×${String(count)}`,
                    )
                    .join(' · ')}
                </p>
              )}
              {item.notes.length > 0 && (
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {item.notes.map((note, i) => (
                    // Note di utenti diversi, anche uguali: la posizione basta come chiave.
                    <li key={i} className="break-words whitespace-pre-line">
                      {note}
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {NEXT_STATUS.filter((s) => s !== item.status).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => void setStatus(item, status)}
                    className={BUTTON}
                  >
                    {t(`admin.queue.set.${status}`)}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
