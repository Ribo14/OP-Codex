import { RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CatalogCard } from '@/catalog/catalog-data'
import { CardThumb } from '@/decks/CardThumb'
import { shownPrinting } from '@/decks/deck'
import { cn } from '@/lib/utils'
import type { TableCard } from './game'

// Pezzi grafici del tavolo (RIB-99): faccia e dorso delle carte, potenza, invito a ruotare.
// Grafica nostra: nessun asset dell'app ufficiale (la rifinitura è RIB-106).

export type ByCode = ReadonlyMap<string, CatalogCard>

/** L'immagine di una carta del tavolo, a faccia in su. */
export function CardFace({
  cardCode,
  printId,
  byCode,
  className,
}: {
  cardCode: string
  printId: string | null
  byCode: ByCode
  className?: string
}) {
  const info = byCode.get(cardCode)
  const printing = info ? shownPrinting(info, printId) : undefined
  return (
    <CardThumb
      printing={printing}
      name={info?.name ?? cardCode}
      className={cn('aspect-[63/88] w-auto max-w-none rounded-md object-cover', className)}
    />
  )
}

/** Dorso di una carta: mazzo, Vita coperta, mano dell'avversario, mazzo DON!!. */
export function CardBack({
  className,
  label,
  tone = 'deck',
}: {
  className?: string
  label?: string
  tone?: 'deck' | 'life' | 'don'
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex aspect-[63/88] items-center justify-center rounded-md border-2 border-white/80 text-[10px] font-bold text-white/85 shadow-md',
        tone === 'deck' && 'bg-gradient-to-br from-slate-700 to-slate-950',
        tone === 'life' && 'bg-gradient-to-br from-amber-600 to-orange-800',
        tone === 'don' && 'bg-gradient-to-br from-violet-600 to-violet-900',
        className,
      )}
    >
      {label}
    </div>
  )
}

/** Numero grande sovrapposto (potenza, Vita, carte nel mazzo), leggibile su ogni sfondo. */
export function BigNumber({
  value,
  highlight = false,
  className,
}: {
  value: number | string
  highlight?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'pointer-events-none leading-none font-black tabular-nums [-webkit-text-stroke:3px_rgb(15_23_42)] [paint-order:stroke]',
        highlight ? 'text-yellow-300' : 'text-white',
        className,
      )}
    >
      {value}
    </span>
  )
}

/** Una carta in campo (o il Leader): ruotata se a riposo, con DON!! e potenza. */
export function FieldCardView({
  card,
  byCode,
  power,
  boosted,
}: {
  card: TableCard
  byCode: ByCode
  power: number | null
  boosted: boolean
}) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'relative block shrink-0 transition-transform duration-200',
        card.rested && 'mx-[calc(var(--card-h)*0.16)] rotate-90',
      )}
    >
      <CardFace
        cardCode={card.cardCode}
        printId={card.printId}
        byCode={byCode}
        className="h-[var(--card-h)] shadow-md"
      />
      {card.don > 0 && (
        <span className="absolute -top-1 -left-1 rounded-md bg-violet-700 px-1 text-[10px] font-bold whitespace-nowrap text-white shadow">
          {t('playtest.donOnCard', { count: card.don })}
        </span>
      )}
      {power !== null && (
        <BigNumber
          value={power}
          highlight={boosted}
          className={cn(
            'absolute -bottom-[0.35em] left-1/2 -translate-x-1/2 text-[calc(var(--card-h)*0.22)]',
            card.rested && '-rotate-90',
          )}
        />
      )}
    </span>
  )
}

/** In verticale sul telefono: invito a ruotare. */
export function RotateHint() {
  const { t } = useTranslation()
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] hidden items-center justify-center bg-background/95 p-8 text-center portrait:max-sm:flex">
      <div className="space-y-3">
        <RotateCcw className="mx-auto size-10" aria-hidden="true" />
        <p className="text-lg font-medium">{t('playtest.rotate')}</p>
      </div>
    </div>
  )
}
