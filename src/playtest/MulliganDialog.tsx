import { useTranslation } from 'react-i18next'
import type { TableCard } from './game'
import { CardFace, type ByCode } from './table-parts'

// Mulligan (RIB-99): finestra sopra il tavolo con le 5 carte della mano iniziale. Si può
// ripescare una volta sola; in solitario si decide anche per l'avversario.

export function MulliganDialog({
  title,
  hand,
  canRedraw,
  byCode,
  onRedraw,
  onKeep,
}: {
  title: string
  hand: readonly TableCard[]
  canRedraw: boolean
  byCode: ByCode
  onRedraw: () => void
  onKeep: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-full max-w-full flex-col items-center gap-[3cqh] rounded-2xl border bg-background/95 px-5 py-[4cqh] shadow-2xl"
      >
        <p className="text-center text-lg font-semibold">{title}</p>
        <ul className="flex max-w-full gap-2 overflow-x-auto">
          {hand.map((c) => (
            <li key={c.id}>
              <CardFace
                cardCode={c.cardCode}
                printId={c.printId}
                byCode={byCode}
                className="h-[36cqh] shadow-md"
              />
            </li>
          ))}
        </ul>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={!canRedraw}
            onClick={onRedraw}
            className="h-11 rounded-full border px-5 font-medium disabled:opacity-40"
          >
            {t('playtest.redraw')}
          </button>
          <button
            type="button"
            onClick={onKeep}
            className="h-11 rounded-full bg-foreground px-5 font-semibold text-background"
          >
            {t('playtest.keep')}
          </button>
        </div>
      </div>
    </div>
  )
}
