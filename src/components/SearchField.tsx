import { Search, X } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/**
 * Campo di ricerca a pillola con la lente e una "X" per svuotarlo (RIB-78). La "X" compare solo
 * col testo e lascia il fuoco nel campo, per scrivere subito un'altra ricerca.
 */
export function SearchField({
  value,
  onChange,
  label,
  className,
}: {
  value: string
  onChange: (value: string) => void
  /** Etichetta per i lettori di schermo, usata anche come placeholder. */
  label: string
  /** Classi del contenitore (altezza, larghezza). */
  className?: string
}) {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  return (
    <div
      className={cn(
        'flex h-10 items-center gap-2 rounded-full border border-border bg-card pr-1.5 pl-4 shadow-xs transition-[box-shadow,border-color] duration-200 focus-within:border-gold focus-within:shadow-[0_0_0_4px_color-mix(in_oklch,var(--gold)_22%,transparent)]',
        className,
      )}
    >
      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <input
        ref={input}
        type="search"
        aria-label={label}
        value={value}
        placeholder={label}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        className="h-full w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground [&::-webkit-search-cancel-button]:appearance-none"
      />
      {value !== '' && (
        <button
          type="button"
          aria-label={t('app.clearSearch')}
          onClick={() => {
            onChange('')
            input.current?.focus()
          }}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-background/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
