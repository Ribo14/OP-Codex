import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { LookDestination, TableCard } from './game'
import { CardFace, type ByCode } from './table-parts'

// Guardare e cercare nel mazzo (RIB-102): finestre sopra il tavolo, viste solo da chi guarda.
// Gli effetti restano a mano (ADR-0011): qui si sceglie solo dove vanno le carte.

const DESTINATIONS: readonly LookDestination[] = ['deckTop', 'hand', 'field', 'trash', 'deckBottom']

function Dialog({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-3">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-full w-full max-w-5xl flex-col gap-3 overflow-y-auto rounded-2xl border bg-background/95 p-4 shadow-2xl"
      >
        <p className="text-center text-lg font-semibold">{title}</p>
        {children}
      </div>
    </div>
  )
}

const BUTTON =
  'h-10 rounded-full border px-4 text-sm font-medium hover:bg-muted disabled:opacity-40'
const PRIMARY = 'h-10 rounded-full bg-foreground px-5 text-sm font-semibold text-background'

/** Le prime N carte: per ognuna dove va, e l'ordine di quelle che restano nel mazzo. */
export function LookDialog({
  cards,
  byCode,
  fieldFree,
  onDone,
  onCancel,
}: {
  cards: readonly TableCard[]
  byCode: ByCode
  /** Posti liberi nell'area Personaggi. */
  fieldFree: number
  onDone: (plan: { id: string; to: LookDestination }[]) => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [plan, setPlan] = useState<{ id: string; to: LookDestination }[]>(() =>
    cards.map((c) => ({ id: c.id, to: 'deckTop' })),
  )
  const byId = new Map(cards.map((c) => [c.id, c]))
  const toField = plan.filter((p) => p.to === 'field').length
  const shift = (i: number, by: -1 | 1) => {
    const j = i + by
    if (j < 0 || j >= plan.length) return
    const next = [...plan]
    const a = next[i]
    const b = next[j]
    if (!a || !b) return
    next[i] = b
    next[j] = a
    setPlan(next)
  }
  return (
    <Dialog title={t('playtest.look.title', { count: cards.length })}>
      <p className="text-center text-xs text-muted-foreground">{t('playtest.look.hint')}</p>
      <ul className="flex justify-center gap-3 overflow-x-auto pb-1">
        {plan.map((p, i) => {
          const card = byId.get(p.id)
          if (!card) return null
          const name = byCode.get(card.cardCode)?.name ?? card.cardCode
          return (
            <li
              key={p.id}
              className="flex w-[min(9rem,22cqw)] shrink-0 flex-col items-center gap-1.5"
            >
              <CardFace
                cardCode={card.cardCode}
                printId={card.printId}
                byCode={byCode}
                className="h-[30cqh] shadow-md"
              />
              <select
                aria-label={t('playtest.look.destination', { name })}
                value={p.to}
                onChange={(e) => {
                  const to = e.target.value as LookDestination
                  setPlan(plan.map((x) => (x.id === p.id ? { ...x, to } : x)))
                }}
                className="h-9 w-full rounded-lg border bg-background px-2 text-xs"
              >
                {DESTINATIONS.map((d) => (
                  <option
                    key={d}
                    value={d}
                    // Il campo ha 5 posti: oltre, la scelta "In campo" non c'è più.
                    disabled={d === 'field' && p.to !== 'field' && toField >= fieldFree}
                  >
                    {t(`playtest.look.to.${d}`)}
                  </option>
                ))}
              </select>
              <div className="flex gap-1">
                <button
                  type="button"
                  aria-label={t('playtest.look.moveLeft', { name })}
                  disabled={i === 0}
                  onClick={() => {
                    shift(i, -1)
                  }}
                  className="inline-flex size-8 items-center justify-center rounded-full border disabled:opacity-30"
                >
                  <ChevronLeft className="size-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t('playtest.look.moveRight', { name })}
                  disabled={i === plan.length - 1}
                  onClick={() => {
                    shift(i, 1)
                  }}
                  className="inline-flex size-8 items-center justify-center rounded-full border disabled:opacity-30"
                >
                  <ChevronRight className="size-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>
      <div className="flex justify-center gap-3">
        <button type="button" onClick={onCancel} className={BUTTON}>
          {t('playtest.look.cancel')}
        </button>
        <button
          type="button"
          onClick={() => {
            onDone(plan)
          }}
          className={PRIMARY}
        >
          {t('playtest.look.done')}
        </button>
      </div>
    </Dialog>
  )
}

/** Tutto il mazzo, in ordine alfabetico (non si svela l'ordine): si prende una carta. */
export function SearchDialog({
  cards,
  byCode,
  fieldFull,
  onTake,
  onClose,
}: {
  cards: readonly TableCard[]
  byCode: ByCode
  fieldFull: boolean
  onTake: (id: string, to: 'hand' | 'field', shuffle: boolean) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [chosen, setChosen] = useState<string | null>(null)
  const [shuffle, setShuffle] = useState(true)
  const nameOf = (c: TableCard) => byCode.get(c.cardCode)?.name ?? c.cardCode
  const sorted = [...cards].sort(
    (a, b) => nameOf(a).localeCompare(nameOf(b)) || a.cardCode.localeCompare(b.cardCode),
  )
  const take = (to: 'hand' | 'field') => {
    if (chosen) onTake(chosen, to, shuffle)
  }
  return (
    <Dialog title={t('playtest.search.title', { count: cards.length })}>
      <p className="text-center text-xs text-muted-foreground">{t('playtest.search.hint')}</p>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(4.5rem,1fr))] gap-2">
        {sorted.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              aria-label={nameOf(c)}
              aria-pressed={chosen === c.id}
              onClick={() => {
                setChosen(c.id)
              }}
              className="block w-full rounded-md aria-pressed:ring-4 aria-pressed:ring-sky-500"
            >
              <CardFace
                cardCode={c.cardCode}
                printId={c.printId}
                byCode={byCode}
                className="h-auto w-full"
              />
            </button>
          </li>
        ))}
      </ul>
      {/* Sempre visibili in fondo: la griglia del mazzo può essere lunga. */}
      <div className="sticky -bottom-4 -mx-4 -mb-4 flex flex-wrap items-center justify-center gap-3 border-t bg-background/95 px-4 py-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={shuffle}
            onChange={(e) => {
              setShuffle(e.target.checked)
            }}
            className="size-4"
          />
          {t('playtest.search.shuffle')}
        </label>
        <button type="button" onClick={onClose} className={BUTTON}>
          {t('playtest.close')}
        </button>
        <button
          type="button"
          disabled={!chosen || fieldFull}
          onClick={() => {
            take('field')
          }}
          className={BUTTON}
        >
          {t('playtest.search.play')}
        </button>
        <button
          type="button"
          disabled={!chosen}
          onClick={() => {
            take('hand')
          }}
          className={PRIMARY + ' disabled:opacity-40'}
        >
          {t('playtest.search.take')}
        </button>
      </div>
    </Dialog>
  )
}
