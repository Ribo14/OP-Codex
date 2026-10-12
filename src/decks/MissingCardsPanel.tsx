import { Check, CircleCheck, Copy, ExternalLink, Printer } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
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

/**
 * Il contenuto di "Carte mancanti", che si apre dal chip nella testata del mazzo (RIB-88): le
 * carte che mancano, la stampa e le liste per i Marketplace.
 */
export function MissingCardsBody({
  leaderCode,
  rows,
  catalog,
  printPath,
}: {
  leaderCode: string
  rows: readonly MissingRow[]
  catalog: ReadonlyMap<string, CatalogCard>
  /** Pagina di stampa delle carte (RIB-80). */
  printPath?: string
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState<Target | null>(null)

  if (missingTotal(rows) === 0) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
        <CircleCheck className="size-4" aria-hidden="true" />
        {t('decks.missing.none')}
      </p>
    )
  }

  const missing = missingCards(rows)
  return (
    <div className="text-sm">
      <div className="space-y-3">
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
          {printPath && (
            <Link
              to={printPath}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background hover:opacity-90"
            >
              <Printer className="size-3.5" aria-hidden="true" />
              {t('print.fromDeck')}
            </Link>
          )}
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
    </div>
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
