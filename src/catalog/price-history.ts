import { getSupabase } from '@/lib/supabase'

// Andamento del prezzo di una Printing (RIB-32, slice 5.3): i Price Snapshot di Cardmarket, letti
// online all'apertura della carta (non viaggiano con il catalogo). Qui anche la geometria del
// grafico, pura e testabile.

export interface PricePoint {
  /** AAAA-MM-GG */
  day: string
  trend: number
}

/** Giorni di storico mostrati. */
export const HISTORY_DAYS = 365

export async function fetchPriceHistory(printId: string): Promise<PricePoint[]> {
  const since = new Date(Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const { data, error } = await getSupabase()
    .from('price_snapshots')
    .select('day, trend')
    .eq('print_id', printId)
    .eq('marketplace', 'cardmarket')
    .gte('day', since)
    .order('day')
  if (error) throw new Error(error.message)
  return data.flatMap((row) => {
    const trend = Number(row.trend)
    return row.trend !== null && Number.isFinite(trend) && trend > 0
      ? [{ day: row.day, trend }]
      : []
  })
}

export interface ChartSize {
  width: number
  height: number
  padding: number
}

export interface ChartGeometry {
  xs: number[]
  ys: number[]
  min: number
  max: number
  /** Percorso SVG della linea. */
  line: string
  /** Percorso SVG dell'area sotto la linea, chiusa sul fondo. */
  area: string
}

const dayNumber = (day: string) => Date.parse(`${day}T00:00:00Z`) / 86_400_000

const round = (n: number) => Math.round(n * 100) / 100

export function chartGeometry(points: readonly PricePoint[], size: ChartSize): ChartGeometry {
  const { width, height, padding } = size
  const days = points.map((p) => dayNumber(p.day))
  const first = days[0] ?? 0
  const span = Math.max((days.at(-1) ?? 0) - first, 1)
  const values = points.map((p) => p.trend)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const xs = days.map((d) => padding + ((d - first) / span) * (width - 2 * padding))
  const ys = values.map((v) =>
    max === min ? height / 2 : padding + ((max - v) / (max - min)) * (height - 2 * padding),
  )
  const line = xs
    .map((x, i) => `${i === 0 ? 'M' : 'L'}${String(round(x))},${String(round(ys[i] ?? 0))}`)
    .join('')
  const bottom = height - padding
  const area =
    xs.length > 0
      ? `${line}L${String(round(xs.at(-1) ?? 0))},${String(bottom)}L${String(round(xs[0] ?? 0))},${String(bottom)}Z`
      : ''
  return { xs, ys, min, max, line, area }
}

/** L'indice del punto con la x più vicina a quella del puntatore; -1 senza punti. */
export function nearestIndex(xs: readonly number[], x: number): number {
  let best = -1
  let distance = Infinity
  xs.forEach((value, i) => {
    const d = Math.abs(value - x)
    if (d < distance) {
      best = i
      distance = d
    }
  })
  return best
}
