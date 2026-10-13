import { Ban, CalendarClock, Eye, Link2Off, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { CardFlag } from './card-flags'

// Simbolini di stato (RIB-97): stesse icone e stessi colori dei tag del dettaglio, ma pieni,
// così si leggono anche sopra l'immagine della carta. `compact`: solo l'icona, con il
// significato per i lettori di schermo e al passaggio del mouse.

const TONE: Record<CardFlag['kind'], string> = {
  banned: 'bg-red-600 text-white',
  restricted: 'bg-red-600 text-white',
  pair: 'bg-red-600 text-white',
  upcoming: 'bg-background text-red-700 ring-1 ring-red-600 dark:text-red-400',
  preview: 'bg-sky-600 text-white',
  notStandard: 'bg-orange-500 text-white',
}

function iconOf(kind: CardFlag['kind']): ReactNode {
  const props = { className: 'size-3 shrink-0', 'aria-hidden': true }
  switch (kind) {
    case 'banned':
      return <Ban {...props} />
    case 'pair':
      return <Link2Off {...props} />
    case 'upcoming':
      return <CalendarClock {...props} />
    case 'preview':
      return <Eye {...props} />
    case 'restricted':
    case 'notStandard':
      return <ShieldAlert {...props} />
  }
}

export function CardFlags({
  flags,
  compact = false,
  className,
}: {
  flags: readonly CardFlag[]
  compact?: boolean
  className?: string
}) {
  const { t, i18n } = useTranslation()
  if (flags.length === 0) return null
  const date = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' }).format(new Date(`${iso}T00:00`))

  const texts = (flag: CardFlag): { short: string; full: string } => {
    switch (flag.kind) {
      case 'banned':
        return { short: t('legality.badge.banned'), full: t('legality.banned') }
      case 'restricted':
        return {
          short: t('legality.short.restricted', { count: flag.copies }),
          full: t('legality.restricted', { count: flag.copies }),
        }
      case 'pair':
        return {
          short: t('legality.badge.pair'),
          full: t('legality.pairWith', { cards: flag.with.join(', ') }),
        }
      case 'upcoming': {
        const text = t(`legality.upcoming.${flag.ban}`, { date: date(flag.from) })
        return { short: text, full: text }
      }
      case 'preview':
        return { short: t('preview.badge'), full: t('preview.title') }
      case 'notStandard':
        return {
          short: t('legality.short.notStandard'),
          full: t('legality.notStandard', { block: flag.block, min: flag.min }),
        }
    }
  }

  return (
    <span className={cn('flex flex-wrap items-center gap-1', className)}>
      {flags.map((flag) => {
        const { short, full } = texts(flag)
        return compact ? (
          <span
            key={flag.kind}
            role="img"
            aria-label={full}
            title={full}
            className={cn(
              'inline-flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full px-1 text-[10px] leading-none font-bold shadow-sm',
              TONE[flag.kind],
            )}
          >
            {iconOf(flag.kind)}
            {flag.kind === 'restricted' && <span aria-hidden="true">{flag.copies}</span>}
          </span>
        ) : (
          <span
            key={flag.kind}
            title={full}
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap shadow-sm',
              TONE[flag.kind],
            )}
          >
            {iconOf(flag.kind)}
            {short}
            {short !== full && <span className="sr-only">: {full}</span>}
          </span>
        )
      })}
    </span>
  )
}
