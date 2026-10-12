import { useTranslation } from 'react-i18next'
import { cardImageUrl } from '@/catalog/card-image'
import { cn } from '@/lib/utils'
import type { PrintColor } from './print-pdf'
import {
  CARD_HEIGHT_MM,
  CARD_WIDTH_MM,
  layoutSheets,
  PAGE_HEIGHT_MM,
  PAGE_WIDTH_MM,
  type PrintItem,
} from './print-sheet'

const percent = (mm: number, of: number) => `${String((mm / of) * 100)}%`

/** Anteprima dei fogli A4 come usciranno dal PDF (RIB-80), con le miniature. */
export function SheetPreview({ items, color }: { items: readonly PrintItem[]; color: PrintColor }) {
  const { t } = useTranslation()
  const sheets = layoutSheets(items)
  if (sheets.length === 0) return null
  return (
    <ol
      aria-label={t('print.preview')}
      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
    >
      {sheets.map((sheet, i) => (
        <li key={i} className="space-y-1">
          <div
            className={cn(
              'relative aspect-[210/297] w-full rounded-sm bg-white shadow-md ring-1 ring-black/10',
              color === 'gray' && 'grayscale',
            )}
          >
            {sheet.map((card, j) => (
              <img
                key={j}
                src={cardImageUrl(card.printId, 'thumb')}
                crossOrigin="anonymous"
                alt=""
                loading="lazy"
                className="absolute outline outline-[0.5px] outline-black/30"
                style={{
                  left: percent(card.x, PAGE_WIDTH_MM),
                  top: percent(card.y, PAGE_HEIGHT_MM),
                  width: percent(CARD_WIDTH_MM, PAGE_WIDTH_MM),
                  height: percent(CARD_HEIGHT_MM, PAGE_HEIGHT_MM),
                }}
              />
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            {t('print.sheet', { n: i + 1, total: sheets.length })}
          </p>
        </li>
      ))}
    </ol>
  )
}
