import { ChevronDown, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Una voce del Profilo in stile impostazioni del telefono (RIB-46): chiusa di default, si apre
 * toccandola. È un <details>, quindi funziona da tastiera e con i lettori di schermo senza codice.
 */
export function SettingsRow({
  icon: Icon,
  title,
  hint,
  status,
  danger = false,
  children,
}: {
  icon: LucideIcon
  title: string
  /** Una riga di spiegazione sotto il titolo. */
  hint?: string
  /** Stato visibile anche da chiusa (es. "Attiva"). */
  status?: ReactNode
  danger?: boolean
  children: ReactNode
}) {
  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <span
          className={cn(
            'inline-flex size-9 shrink-0 items-center justify-center rounded-full',
            danger ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground',
          )}
          aria-hidden="true"
        >
          <Icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn('block text-sm font-medium', danger && 'text-destructive')}>
            {title}
          </span>
          {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
        </span>
        {status}
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="px-4 pt-1 pb-4">{children}</div>
    </details>
  )
}
