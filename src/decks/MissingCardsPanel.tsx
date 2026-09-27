import { Check, CircleCheck, Copy, ExternalLink, PackageSearch } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CatalogCard } from '@/catalog/catalog-data'
import { copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import {
  cardmarketWantsText,
  cardtraderWishlistText,
  missingCards,
  missingListText,
  missingTotal,
  type MissingRow,
} from './missing-cards'

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
  const [copied, setCopied] = useState<Target | null>(null)
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
        <div className="flex flex-wrap gap-2">
          {TARGETS.map((target) => (
            <button
              key={target}
              type="button"
              onClick={() => {
                void copyText(TEXT[target](leaderCode, rows, catalog)).then((ok) => {
                  setCopied(ok ? target : null)
                })
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted"
            >
              {copied === target ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <Copy className="size-3.5" aria-hidden="true" />
              )}
              {copied === target ? t('decks.list.copied') : t(`decks.missing.copyFor.${target}`)}
            </button>
          ))}
        </div>
        {/* Dopo la copia per un Marketplace: dove incollarla. */}
        {copied !== null && copied !== 'list' && (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {t(`decks.missing.pasteIn.${copied}`)}{' '}
            <a
              href={PASTE_URL[copied]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-2"
            >
              {t(`decks.missing.open.${copied}`)}
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          </p>
        )}
      </div>
    </details>
  )
}

/** Cosa si copia: la Deck List (per l'app e i simulatori) o le liste per i Marketplace. */
const TARGETS = ['list', 'cardmarket', 'cardtrader'] as const
type Target = (typeof TARGETS)[number]

const TEXT: Record<Target, typeof missingListText> = {
  list: missingListText,
  cardmarket: cardmarketWantsText,
  cardtrader: cardtraderWishlistText,
}

/** Dove incollare la lista: i Wants di Cardmarket, una nuova wishlist di CardTrader. */
const PASTE_URL: Record<Exclude<Target, 'list'>, string> = {
  cardmarket: 'https://www.cardmarket.com/it/OnePiece/Wants',
  cardtrader: 'https://www.cardtrader.com/it/wishlists/new',
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
