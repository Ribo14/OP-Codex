import { useState } from 'react'

// Dimensione delle carte nella griglia di Catalogo e Collezione (RIB-79): su telefono 2, 4 o 6
// per riga, sugli schermi più larghi in proporzione. Scelta ricordata sul dispositivo e comune
// alle due pagine.

export const GRID_SIZES = ['large', 'medium', 'small'] as const
export type GridSize = (typeof GRID_SIZES)[number]

const STORAGE_KEY = 'op-codex-grid-size'

function readGridSize(): GridSize {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return GRID_SIZES.find((size) => size === stored) ?? 'large'
  } catch {
    return 'large'
  }
}

export function useGridSize(): [GridSize, (size: GridSize) => void] {
  const [size, setSize] = useState<GridSize>(readGridSize)
  const update = (next: GridSize) => {
    setSize(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* la scelta vale solo per questa sessione */
    }
  }
  return [size, update]
}

// Classi scritte per intero: Tailwind le trova solo così.
const COLUMNS: Record<GridSize, { base: string; full: string; withDetail: string }> = {
  large: {
    base: 'grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6',
    full: 'xl:grid-cols-5 2xl:grid-cols-6',
    withDetail: 'lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4',
  },
  medium: {
    base: 'grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6 lg:gap-3',
    full: 'lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10',
    withDetail: 'lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
  },
  small: {
    base: 'grid-cols-6 gap-1 sm:grid-cols-8 md:grid-cols-10 lg:gap-1.5',
    full: 'lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-14',
    withDetail: 'lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10',
  },
}

/** Le colonne della griglia; `withDetail` quando accanto c'è il pannello del dettaglio. */
export function gridColumns(size: GridSize, withDetail = false): string {
  const columns = COLUMNS[size]
  return `grid ${columns.base} ${withDetail ? columns.withDetail : columns.full}`
}
