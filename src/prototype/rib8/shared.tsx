// PROTOTIPO RIB-8 (usa e getta): pezzi piccoli condivisi dalle varianti.
import { BookOpen, Layers, LibraryBig, Moon, Sun, User, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cardImageUrl } from '@/catalog/card-image'
import { cn } from '@/lib/utils'

/** I sei colori del gioco, usati come accenti. */
export const GAME_COLORS: Record<string, string> = {
  Red: '#d33a2c',
  Green: '#1f9d55',
  Blue: '#2563eb',
  Purple: '#7c3aed',
  Black: '#3f3f46',
  Yellow: '#e0a800',
}

export const COLOR_LABELS: Record<string, string> = {
  Red: 'Rosso',
  Green: 'Verde',
  Blue: 'Blu',
  Purple: 'Viola',
  Black: 'Nero',
  Yellow: 'Giallo',
}

export const NAV_ITEMS = [
  { key: 'catalogo', label: 'Catalogo', icon: LibraryBig, ready: true },
  { key: 'mazzi', label: 'Mazzi', icon: Layers, ready: false },
  { key: 'collezione', label: 'Collezione', icon: WalletCards, ready: false },
  { key: 'regole', label: 'Regole', icon: BookOpen, ready: false },
  { key: 'profilo', label: 'Profilo', icon: User, ready: false },
] as const

export function colorGradient(colors: string[]): string {
  const values = colors.map((c) => GAME_COLORS[c] ?? '#888')
  if (values.length <= 1) return values[0] ?? '#888'
  return `linear-gradient(90deg, ${values.join(', ')})`
}

export function ColorDots({ colors, className }: { colors: string[]; className?: string }) {
  return (
    <span className={cn('inline-flex gap-1', className)}>
      {colors.map((c) => (
        <span
          key={c}
          title={COLOR_LABELS[c] ?? c}
          className="inline-block size-2.5 rounded-full ring-1 ring-black/10"
          style={{ background: GAME_COLORS[c] ?? '#888' }}
        />
      ))}
    </span>
  )
}

export function CardImage({
  printId,
  name,
  hasImage,
  variant = 'thumb',
  className,
}: {
  printId: string
  name: string
  hasImage: boolean
  variant?: 'thumb' | 'full'
  className?: string
}) {
  if (!hasImage) {
    return (
      <div
        className={cn(
          'flex aspect-[300/419] w-full items-center justify-center bg-muted p-2 text-center text-xs text-muted-foreground',
          className,
        )}
      >
        {name}
        <br />
        (immagine in arrivo)
      </div>
    )
  }
  return (
    <img
      src={cardImageUrl(printId, variant)}
      alt={name}
      width={variant === 'thumb' ? 300 : 600}
      height={variant === 'thumb' ? 419 : 838}
      loading={variant === 'full' ? 'eager' : 'lazy'}
      decoding="async"
      className={cn('aspect-[300/419] h-auto w-full bg-muted object-cover', className)}
    />
  )
}

/** Tema chiaro/scuro: segue il sistema finché non si sceglie a mano. */
export function useTheme() {
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('proto-theme')
      if (saved) return saved === 'dark'
    } catch {
      /* storage non disponibile */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])
  const toggle = () => {
    setDark((d) => {
      try {
        localStorage.setItem('proto-theme', d ? 'light' : 'dark')
      } catch {
        /* storage non disponibile */
      }
      return !d
    })
  }
  return { dark, toggle }
}

export function ThemeButton({ className }: { className?: string }) {
  const { dark, toggle } = useTheme()
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full text-foreground/80 hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  )
}

export function statLine(card: {
  category: string
  cost: number | null
  life: number | null
  power: number | null
  counter: number | null
}) {
  const parts: [string, string][] = []
  if (card.category === 'Leader' && card.life !== null) parts.push(['Vita', String(card.life)])
  if (card.cost !== null) parts.push(['Costo', String(card.cost)])
  if (card.power !== null) parts.push(['Potenza', String(card.power)])
  if (card.counter !== null) parts.push(['Counter', `+${String(card.counter)}`])
  return parts
}
