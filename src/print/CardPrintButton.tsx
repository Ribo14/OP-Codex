import { Printer } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CatalogCard, CatalogPrinting } from '@/catalog/catalog-data'
import { cn } from '@/lib/utils'
import type { PrintColor } from './print-pdf'
import { PrintColorToggle, PrintPdfPanel } from './PrintPdfPanel'

const COPIES = [1, 2, 3, 4] as const

/** "Stampa" nel dettaglio di una carta (RIB-80): da 1 a 4 copie della Printing mostrata. */
export function CardPrintButton({
  card,
  printing,
}: {
  card: CatalogCard
  printing: CatalogPrinting
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [copies, setCopies] = useState<number>(1)
  const [color, setColor] = useState<PrintColor>('color')

  if (!printing.hasImage) return null
  return (
    <div className="space-y-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v)
        }}
        className="inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium hover:bg-muted"
      >
        <Printer className="size-4" aria-hidden="true" />
        {t('print.cardButton')}
      </button>
      {open && (
        <section
          aria-label={t('print.cardTitle', { printId: printing.printId })}
          className="space-y-3 rounded-2xl border p-4"
        >
          <p className="text-sm text-muted-foreground">
            {t('print.cardTitle', { printId: printing.printId })}
          </p>
          <div
            role="group"
            aria-label={t('print.copiesLabel')}
            className="flex w-fit rounded-full bg-muted p-1"
          >
            {COPIES.map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={copies === n}
                onClick={() => {
                  setCopies(n)
                }}
                className={cn(
                  'min-w-10 rounded-full px-3 py-1.5 text-xs font-semibold tabular-nums transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  copies === n ? 'bg-background shadow-sm' : 'text-muted-foreground',
                )}
              >
                ×{n}
              </button>
            ))}
          </div>
          <PrintColorToggle color={color} onChange={setColor} />
          <PrintPdfPanel
            items={[{ printId: printing.printId, copies, preview: printing.preview === true }]}
            name={`${card.name} ${printing.printId}`}
            color={color}
          />
        </section>
      )}
    </div>
  )
}
