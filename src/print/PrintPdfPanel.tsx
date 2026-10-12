import { Download, FileDown, Printer, Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import {
  canSharePdf,
  createPrintPdf,
  downloadPdf,
  pdfFileName,
  PRINT_COLORS,
  sharePdf,
  type PrintColor,
} from './print-pdf'
import { sheetCount, totalCopies, type PrintItem } from './print-sheet'

// Stampa delle carte (RIB-80): colore o bianco e nero, riepilogo, creazione del PDF e poi
// condivisione (telefono) o download.

type Status =
  | { step: 'idle' }
  | { step: 'working'; done: number; total: number }
  | { step: 'ready'; file: File }
  | { step: 'error' }

export function PrintColorToggle({
  color,
  onChange,
}: {
  color: PrintColor
  onChange: (color: PrintColor) => void
}) {
  const { t } = useTranslation()
  return (
    <div
      role="group"
      aria-label={t('print.color')}
      className="flex w-fit rounded-full bg-muted p-1"
    >
      {PRINT_COLORS.map((key) => (
        <button
          key={key}
          type="button"
          aria-pressed={color === key}
          onClick={() => {
            onChange(key)
          }}
          className={cn(
            'rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            color === key ? 'bg-background shadow-sm' : 'text-muted-foreground',
          )}
        >
          {t(`print.colors.${key}`)}
        </button>
      ))}
    </div>
  )
}

export function PrintPdfPanel({
  items,
  name,
  color,
}: {
  items: readonly PrintItem[]
  /** Nome del file: del mazzo o della carta. */
  name: string
  color: PrintColor
}) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<Status>({ step: 'idle' })
  const copies = totalCopies(items)
  const sheets = sheetCount(items)

  // Cambiate le carte o il colore, il PDF pronto non vale più.
  const key = `${color}|${items.map((i) => `${i.printId}:${String(i.copies)}`).join(',')}`
  const [previousKey, setPreviousKey] = useState(key)
  if (previousKey !== key) {
    setPreviousKey(key)
    if (status.step !== 'working') setStatus({ step: 'idle' })
  }

  const create = () => {
    setStatus({ step: 'working', done: 0, total: 0 })
    createPrintPdf(items, color, (done, total) => {
      setStatus({ step: 'working', done, total })
    }).then(
      (blob) => {
        setStatus({
          step: 'ready',
          file: new File([blob], pdfFileName(name), { type: 'application/pdf' }),
        })
      },
      () => {
        setStatus({ step: 'error' })
      },
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium" aria-live="polite">
        {t('print.cards', { count: copies })} · {t('print.sheets', { count: sheets })}
      </p>

      {status.step === 'ready' ? (
        <div className="flex flex-wrap gap-2">
          {canSharePdf(status.file) && (
            <button
              type="button"
              onClick={() => void sharePdf(status.file)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90"
            >
              <Share2 className="size-4" aria-hidden="true" />
              {t('print.share')}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              downloadPdf(status.file)
            }}
            className={cn(
              'inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-medium',
              canSharePdf(status.file)
                ? 'border hover:bg-muted'
                : 'bg-foreground text-background hover:opacity-90',
            )}
          >
            <Download className="size-4" aria-hidden="true" />
            {t('print.download')}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={copies === 0 || status.step === 'working'}
          onClick={create}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
        >
          {status.step === 'working' ? (
            <FileDown className="size-4 animate-pulse" aria-hidden="true" />
          ) : (
            <Printer className="size-4" aria-hidden="true" />
          )}
          {status.step === 'working'
            ? t('print.working', { done: status.done, total: status.total })
            : t('print.create')}
        </button>
      )}

      {status.step === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          {t('print.failed')}
        </p>
      )}

      <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
        <li>{t('print.hintScale')}</li>
        <li>{t('print.hintCut')}</li>
        <li>{t('print.hintProxy')}</li>
      </ul>
    </div>
  )
}
