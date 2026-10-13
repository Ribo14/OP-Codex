import type { CSSProperties } from 'react'

// Sfondo del Tavolo di prova: blu con le onde giapponesi (seigaiha), disegnato qui in SVG.
// Ispirato allo sfondo proposto dall'utente (13/10), che però conteneva il logo di ONE PIECE:
// niente loghi né immagini ufficiali (RIB-106). In alto una velatura rossa per il lato
// dell'avversario, come nell'app ufficiale.

const R = 20

/** Una "squama" di onde: cerchio pieno e anelli concentrici. */
function scale(cx: number, cy: number, fill: string): string {
  const rings = [0.75, 0.5, 0.25]
    .map((k) => `<circle cx="${String(cx)}" cy="${String(cy)}" r="${String(R * k)}"/>`)
    .join('')
  return (
    `<circle cx="${String(cx)}" cy="${String(cy)}" r="${String(R)}" fill="${fill}"/>` +
    `<g fill="none">${rings}</g>`
  )
}

/**
 * Tassello 2R × R: le righe in basso coprono quelle in alto, così ogni squama mostra solo la
 * metà superiore anche ripetendo il tassello.
 */
export function seigaihaSvg(fill: string, stroke: string): string {
  const order: [number, number][] = [
    [0, 0],
    [2 * R, 0],
    [R, R / 2],
    [0, R],
    [2 * R, R],
  ]
  const body = order.map(([x, y]) => scale(x, y, fill)).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${String(2 * R)}" height="${String(R)}" viewBox="0 0 ${String(2 * R)} ${String(R)}"><g stroke="${stroke}" stroke-width="1.2">${body}</g></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const OVERLAY =
  'linear-gradient(to bottom, rgb(220 38 38 / 0.22), transparent 45%), radial-gradient(ellipse at center, transparent 55%, rgb(2 6 23 / 0.25))'

/** Variabili CSS per tema chiaro e scuro, da usare con le classi di TABLE_BACKGROUND. */
export const tableBackgroundStyle = {
  '--table-bg-light': `${OVERLAY}, ${seigaihaSvg('#93cdf1', '#bfe3f9')}`,
  '--table-bg-dark': `${OVERLAY}, ${seigaihaSvg('#0c2a47', '#1a4f80')}`,
} as CSSProperties

export const TABLE_BACKGROUND =
  'bg-[image:var(--table-bg-light)] bg-[length:auto,auto,48px_24px] dark:bg-[image:var(--table-bg-dark)]'
