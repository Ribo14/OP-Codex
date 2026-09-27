import { useEffect, useState, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useOnline } from '@/lib/use-online'
import { useEuro } from './price-format'
import { chartGeometry, fetchPriceHistory, nearestIndex, type PricePoint } from './price-history'

// Andamento del prezzo di tendenza (RIB-32, slice 5.3, user story 62): una serie sola, quindi
// linea con area leggera e niente legenda; al passaggio del puntatore (o del dito) una linea
// verticale e il valore del giorno più vicino. Una tabella nascosta porta gli stessi valori ai
// lettori di schermo. Solo online: lo storico non viaggia con il catalogo.

const SIZE = { width: 320, height: 110, padding: 6 }

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; points: PricePoint[] }

export function PriceHistoryChart({ printId }: { printId: string }) {
  const { t } = useTranslation()
  const online = useOnline()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    if (!online) return
    let current = true
    fetchPriceHistory(printId).then(
      (points) => {
        if (current) setState({ status: 'ready', points })
      },
      () => {
        if (current) setState({ status: 'error' })
      },
    )
    return () => {
      current = false
    }
  }, [printId, online])

  if (!online)
    return <p className="text-xs text-muted-foreground">{t('detail.price.historyOffline')}</p>
  if (state.status === 'loading') return null
  if (state.status === 'error')
    return <p className="text-xs text-muted-foreground">{t('detail.price.historyError')}</p>
  if (state.points.length < 2)
    return <p className="text-xs text-muted-foreground">{t('detail.price.historySoon')}</p>
  return <Chart points={state.points} />
}

function Chart({ points }: { points: PricePoint[] }) {
  const { t, i18n } = useTranslation()
  const euro = useEuro()
  const [hover, setHover] = useState<number | null>(null)
  const g = chartGeometry(points, SIZE)
  const date = (day: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short' }).format(
      new Date(`${day}T12:00:00`),
    )

  const move = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * SIZE.width
    setHover(nearestIndex(g.xs, x))
  }

  const point = hover === null ? undefined : points[hover]
  const hoverX = hover === null ? 0 : (g.xs[hover] ?? 0)
  const hoverY = hover === null ? 0 : (g.ys[hover] ?? 0)
  const first = points[0]
  const last = points.at(-1)

  return (
    <figure className="space-y-1">
      <figcaption className="text-xs text-muted-foreground">
        {t('detail.price.history', { count: points.length })}
      </figcaption>
      {/* pt-8: la fascia in alto è del tooltip, così non copre la didascalia. */}
      <div className="relative pt-8">
        <svg
          viewBox={`0 0 ${String(SIZE.width)} ${String(SIZE.height)}`}
          className="h-28 w-full touch-pan-y overflow-visible text-foreground"
          preserveAspectRatio="none"
          aria-hidden="true"
          onPointerMove={move}
          onPointerDown={move}
          onPointerLeave={() => {
            setHover(null)
          }}
        >
          <path d={g.area} fill="currentColor" opacity={0.08} />
          <path
            d={g.line}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {point && (
            <>
              <line
                x1={hoverX}
                x2={hoverX}
                y1={0}
                y2={SIZE.height}
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
              <circle
                cx={hoverX}
                cy={hoverY}
                r={4}
                fill="currentColor"
                className="stroke-background"
                strokeWidth={2}
                vectorEffect="non-scaling-stroke"
              />
            </>
          )}
        </svg>
        {point && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border bg-background px-2 py-1 text-xs whitespace-nowrap shadow-sm"
            // Ai bordi il tooltip resta dentro il grafico.
            style={{
              left: `${String(Math.min(Math.max((hoverX / SIZE.width) * 100, 18), 82))}%`,
            }}
          >
            <span className="text-muted-foreground">{date(point.day)}</span>{' '}
            <span className="font-medium tabular-nums">{euro(point.trend)}</span>
          </div>
        )}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{first && date(first.day)}</span>
        <span>{t('detail.price.range', { min: euro(g.min), max: euro(g.max) })}</span>
        <span>{last && date(last.day)}</span>
      </div>
      <table className="sr-only">
        <caption>{t('detail.price.historyTable')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('detail.price.day')}</th>
            <th scope="col">{t('detail.price.trend')}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.day}>
              <td>{date(p.day)}</td>
              <td>{euro(p.trend)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
