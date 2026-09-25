import { Check, CircleCheck, Copy, PackageSearch } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CatalogCard } from '@/catalog/catalog-data'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { missingCards, missingListText, missingTotal, type MissingRow } from './missing-cards'

// Carte mancanti (RIB-25): cosa manca nella Collection per giocare il Deck dal vivo.

export function MissingCardsPanel({
  leaderCode,
  rows,
  catalog,
  loading,
}: {
  leaderCode: string
  rows: readonly MissingRow[]
  catalog: ReadonlyMap<string, CatalogCard>
  /** La Collection non è ancora caricata. */
  loading: boolean
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  if (loading) return null

  const total = missingTotal(rows)
  if (total === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-emerald-600/10 px-4 py-3 text-sm font-medium text-emerald-800 dark:text-emerald-300">
        <CircleCheck className="size-4" aria-hidden="true" />
        {t('decks.missing.none')}
      </p>
    )
  }

  const missing = missingCards(rows)
  return (
    <details className="rounded-2xl border text-sm">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium">
        <PackageSearch className="size-4 shrink-0" aria-hidden="true" />
        {t('decks.missing.count', { count: total })}
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <ul className="divide-y">
          {missing.map((row) => (
            <li key={row.cardCode} className="flex items-center gap-3 py-1.5">
              <span className="min-w-0 flex-1 truncate">
                {catalog.get(row.cardCode)?.name ?? row.cardCode}{' '}
                <span className="text-xs text-muted-foreground">{row.cardCode}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t('decks.missing.have', { owned: row.owned, required: row.required })}
              </span>
              <span className="w-10 text-right font-semibold tabular-nums">−{row.missing}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            void copyText(missingListText(leaderCode, rows, catalog)).then((ok) => {
              setCopied(ok)
              window.setTimeout(() => {
                setCopied(false)
              }, 2500)
            })
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted"
        >
          {copied ? (
            <Check className="size-3.5" aria-hidden="true" />
          ) : (
            <Copy className="size-3.5" aria-hidden="true" />
          )}
          {copied ? t('decks.list.copied') : t('decks.missing.copy')}
        </button>
      </div>
    </details>
  )
}

/** Segno "2/4" accanto a una carta del Deck: copie possedute sulle richieste. */
export function OwnedBadge({ row }: { row: MissingRow }) {
  const { t } = useTranslation()
  const complete = row.missing === 0
  return (
    <span
      title={t('decks.missing.have', { owned: row.owned, required: row.required })}
      aria-label={t('decks.missing.have', { owned: row.owned, required: row.required })}
      className={cn(
        'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
        complete
          ? 'bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-amber-500/15 text-amber-800 dark:text-amber-300',
      )}
    >
      {Math.min(row.owned, row.required)}/{row.required}
    </span>
  )
}
