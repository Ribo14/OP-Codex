import { CircleCheck, TriangleAlert } from 'lucide-react'
import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CatalogCard } from '@/catalog/catalog-data'
import { cn } from '@/lib/utils'
import type { DeckWarning } from './deck-rules'

// Deck Warning (RIB-23): non bloccano mai il salvataggio, avvisano soltanto.

/** "Valido" o "N avvisi", per l'elenco dei Mazzi. */
export function ValidityBadge({ warnings }: { warnings: number }) {
  const { t } = useTranslation()
  return warnings === 0 ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
      <CircleCheck className="size-3.5" aria-hidden="true" />
      {t('decks.valid')}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">
      <TriangleAlert className="size-3.5" aria-hidden="true" />
      {t('decks.warningsCount', { count: warnings })}
    </span>
  )
}

/** Riquadro in cima all'editor: "Mazzo valido" oppure gli avvisi, che si aprono in un elenco. */
export function DeckWarningsPanel({
  warnings,
  catalog,
}: {
  warnings: readonly DeckWarning[]
  catalog: ReadonlyMap<string, CatalogCard>
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const listId = useId()

  if (warnings.length === 0) {
    return (
      <p
        role="status"
        className="flex items-center gap-2 rounded-2xl bg-emerald-600/10 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300"
      >
        <CircleCheck className="size-4" aria-hidden="true" />
        {t('decks.validDeck')}
      </p>
    )
  }

  const names = (codes: readonly string[]) =>
    codes.map((code) => catalog.get(code)?.name ?? code).join(', ')

  return (
    <div className="rounded-2xl bg-amber-500/10 text-sm">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          setOpen((v) => !v)
        }}
        className="flex w-full items-center gap-2 px-4 py-3 text-left font-medium text-amber-900 dark:text-amber-200"
      >
        <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">{t('decks.warningsCount', { count: warnings.length })}</span>
        <span className="text-xs underline underline-offset-2">
          {open ? t('decks.hide') : t('decks.show')}
        </span>
      </button>
      <ul id={listId} hidden={!open} className="space-y-2 px-4 pb-3">
        {warnings.map((w, index) => (
          <li key={`${w.code}-${String(index)}`} className="border-t border-amber-500/20 pt-2">
            <p>{t(`decks.warning.${w.code}`, w.params)}</p>
            {w.cards.length > 0 && (
              <p className={cn('mt-0.5 text-xs text-muted-foreground')}>{names(w.cards)}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
