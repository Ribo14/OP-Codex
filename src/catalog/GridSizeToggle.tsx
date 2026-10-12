import { Columns2, Grid2x2, Grid3x3 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { GRID_SIZES, type GridSize } from './grid-size'

const ICONS = { large: Columns2, medium: Grid2x2, small: Grid3x3 } as const

/** Carte grandi, medie o piccole nella griglia (RIB-79). */
export function GridSizeToggle({
  size,
  onChange,
}: {
  size: GridSize
  onChange: (size: GridSize) => void
}) {
  const { t } = useTranslation()
  return (
    <div role="group" aria-label={t('catalog.gridSize')} className="flex rounded-full bg-muted p-1">
      {GRID_SIZES.map((key) => {
        const Icon = ICONS[key]
        return (
          <button
            key={key}
            type="button"
            aria-pressed={size === key}
            aria-label={t(`catalog.gridSizes.${key}`)}
            title={t(`catalog.gridSizes.${key}`)}
            onClick={() => {
              onChange(key)
            }}
            className={cn(
              'inline-flex items-center rounded-full px-2.5 py-1.5 transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              size === key ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
