import { CircleCheck, Link2, PackageSearch, TriangleAlert } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { CatalogCard } from '@/catalog/catalog-data'
import { cn } from '@/lib/utils'
import { toVisibility, type DeckSummary } from './deck'
import type { DeckWarning } from './deck-rules'
import type { DeckStore } from './deck-store'
import { DeckWarningsList } from './DeckWarnings'
import { missingTotal, type MissingRow } from './missing-cards'
import { MissingCardsBody } from './MissingCardsPanel'
import { ShareDeckBody } from './ShareDeckSection'

// Stato del mazzo in una riga (RIB-88): avvisi, carte mancanti e condivisione erano tre riquadri
// a tutta larghezza; ora sono tre chip, e toccandone uno si apre il suo contenuto qui sotto.

type Panel = 'warnings' | 'missing' | 'share'

const TONE = {
  ok: 'border-emerald-600/30 bg-emerald-600/10 text-emerald-800 dark:text-emerald-300',
  warn: 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200',
  neutral: 'border-border text-foreground',
} as const

export function DeckStatusBar({
  deck,
  store,
  disabled,
  warnings,
  catalog,
  ownership,
  collectionLoading,
  printPath,
}: {
  deck: DeckSummary
  store: DeckStore
  disabled: boolean
  warnings: readonly DeckWarning[]
  catalog: ReadonlyMap<string, CatalogCard>
  /** Carte del mazzo con possedute e mancanti (RIB-25). */
  ownership: readonly MissingRow[]
  /** La Collection non è ancora caricata: niente chip delle mancanti. */
  collectionLoading: boolean
  printPath: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState<Panel | null>(null)
  const panelId = useId()
  const missing = missingTotal(ownership)
  const visibility = toVisibility(deck.visibility, deck.shareToken)

  const chip = (
    panel: Panel,
    tone: keyof typeof TONE,
    icon: ReactNode,
    label: string,
    aria: string,
  ) => (
    <button
      type="button"
      aria-expanded={open === panel}
      aria-controls={panelId}
      aria-label={aria}
      onClick={() => {
        setOpen((current) => (current === panel ? null : panel))
      }}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition',
        TONE[tone],
        open === panel && 'ring-2 ring-ring',
      )}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {warnings.length === 0
          ? chip(
              'warnings',
              'ok',
              <CircleCheck className="size-3.5" aria-hidden="true" />,
              t('decks.status.valid'),
              t('decks.validDeck'),
            )
          : chip(
              'warnings',
              'warn',
              <TriangleAlert className="size-3.5" aria-hidden="true" />,
              t('decks.warningsCount', { count: warnings.length }),
              t('decks.warningsCount', { count: warnings.length }),
            )}
        {!collectionLoading &&
          (missing === 0
            ? chip(
                'missing',
                'ok',
                <PackageSearch className="size-3.5" aria-hidden="true" />,
                t('decks.status.complete'),
                t('decks.missing.none'),
              )
            : chip(
                'missing',
                'neutral',
                <PackageSearch className="size-3.5" aria-hidden="true" />,
                t('decks.status.missing', { count: missing }),
                t('decks.missing.count', { count: missing }),
              ))}
        {chip(
          'share',
          'neutral',
          <Link2 className="size-3.5" aria-hidden="true" />,
          t(`decks.visibility.${visibility}`),
          t('decks.status.share', { visibility: t(`decks.visibility.${visibility}`) }),
        )}
      </div>
      {open && (
        <div id={panelId} className="rounded-2xl border p-4">
          {open === 'warnings' && <DeckWarningsList warnings={warnings} catalog={catalog} />}
          {open === 'missing' && (
            <MissingCardsBody
              leaderCode={deck.leaderCode}
              rows={ownership}
              catalog={catalog}
              printPath={printPath}
            />
          )}
          {open === 'share' && <ShareDeckBody deck={deck} store={store} disabled={disabled} />}
        </div>
      )}
    </div>
  )
}
