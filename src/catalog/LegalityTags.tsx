import { Ban, CalendarClock, Link2Off, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { isStandardLegal, minimumStandardBlock } from '@/decks/deck-rules'
import { cn } from '@/lib/utils'
import { banStatus, useBanListEntries, type BanKind } from './ban-list'
import type { CatalogCard } from './catalog-data'

// Tag di legalità (RIB-29): rossi e ben visibili per Ban List (bandita, limitata, coppia
// bandita), arancione per le carte non valide nel formato Standard (Block Number System).

const RED = 'bg-red-600 text-white shadow-sm'
/** Voce futura: rossa ma non piena, non vale ancora. */
const RED_SOON = 'bg-red-600/10 text-red-700 ring-1 ring-red-600/40 dark:text-red-300'
const ORANGE = 'bg-orange-500/15 text-orange-800 ring-1 ring-orange-500/40 dark:text-orange-300'

function Tag({ tone, icon, children }: { tone: string; icon: ReactNode; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        tone,
      )}
    >
      {icon}
      {children}
    </span>
  )
}

/** Nel dettaglio Card: tutti i tag, con il link all'altra carta di una coppia bandita. */
export function LegalityTags({
  card,
  cards,
}: {
  card: CatalogCard
  cards: readonly CatalogCard[]
}) {
  const { t, i18n } = useTranslation()
  const entries = useBanListEntries()
  const today = new Date()
  const status = banStatus(card.cardCode, entries, today)
  const standardOk = isStandardLegal(card.block, today)
  if (!status && standardOk) return null

  const nameOf = (code: string) => cards.find((c) => c.cardCode === code)?.name ?? code
  const date = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' }).format(new Date(`${iso}T00:00`))

  return (
    <div className="flex flex-wrap items-center gap-2" aria-label={t('legality.label')}>
      {status?.banned && (
        <Tag tone={RED} icon={<Ban className="size-3.5" aria-hidden="true" />}>
          {t('legality.banned')}
        </Tag>
      )}
      {status?.restricted !== null && status?.restricted !== undefined && (
        <Tag tone={RED} icon={<ShieldAlert className="size-3.5" aria-hidden="true" />}>
          {t('legality.restricted', { count: status.restricted })}
        </Tag>
      )}
      {status?.pairedWith.map((code) => (
        <Tag key={code} tone={RED} icon={<Link2Off className="size-3.5" aria-hidden="true" />}>
          {t('legality.pair')}{' '}
          <Link to={`/carta/${encodeURIComponent(code)}`} className="underline underline-offset-2">
            {nameOf(code)} ({code})
          </Link>
        </Tag>
      ))}
      {status?.upcoming && (
        <Tag tone={RED_SOON} icon={<CalendarClock className="size-3.5" aria-hidden="true" />}>
          {t(`legality.upcoming.${status.upcoming.kind}`, { date: date(status.upcoming.from) })}
        </Tag>
      )}
      {!standardOk && (
        <Tag tone={ORANGE} icon={<ShieldAlert className="size-3.5" aria-hidden="true" />}>
          {t('legality.notStandard', { block: card.block ?? '', min: minimumStandardBlock(today) })}
        </Tag>
      )}
    </div>
  )
}

/** Tag rosso sopra la miniatura nella griglia. */
export function BanBadge({ kind, className }: { kind: BanKind; className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-md',
        className,
      )}
    >
      <Ban className="size-3" aria-hidden="true" />
      {t(`legality.badge.${kind}`)}
    </span>
  )
}
