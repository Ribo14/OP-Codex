import { useRef, useState, type TouchEvent } from 'react'

/** Spostamento orizzontale minimo (px) perché il gesto conti come swipe. */
export const SWIPE_MIN_PX = 50

/**
 * Swipe orizzontale con il dito: direzione 1 = elemento successivo (dito verso sinistra),
 * -1 = precedente (dito verso destra). `offset` segue il dito mentre il gesto è in corso, per l'animazione.
 * I gesti più verticali che orizzontali restano allo scorrimento della pagina
 * (l'elemento va marcato con `touch-action: pan-y`).
 */
export function useSwipe({
  canGo,
  onSwipe,
}: {
  canGo: (direction: 1 | -1) => boolean
  onSwipe: (direction: 1 | -1) => void
}) {
  const start = useRef<{ x: number; y: number; horizontal: boolean | null } | null>(null)
  const [offset, setOffset] = useState(0)

  const handlers = {
    onTouchStart: (e: TouchEvent) => {
      const touch = e.touches[0]
      start.current =
        e.touches.length === 1 && touch
          ? { x: touch.clientX, y: touch.clientY, horizontal: null }
          : null
    },
    onTouchMove: (e: TouchEvent) => {
      const s = start.current
      const touch = e.touches[0]
      if (!s || !touch) return
      const dx = touch.clientX - s.x
      const dy = touch.clientY - s.y
      // La direzione si decide una volta sola, ai primi pixel di movimento.
      if (s.horizontal === null && Math.hypot(dx, dy) > 8)
        s.horizontal = Math.abs(dx) > Math.abs(dy)
      if (!s.horizontal) return
      // Oltre la prima o l'ultima Printing il dito "frena".
      setOffset(canGo(dx < 0 ? 1 : -1) ? dx : dx / 4)
    },
    onTouchEnd: (e: TouchEvent) => {
      const s = start.current
      const touch = e.changedTouches[0]
      start.current = null
      setOffset(0)
      if (!s || !touch || s.horizontal === false) return
      const dx = touch.clientX - s.x
      const dy = touch.clientY - s.y
      if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) <= Math.abs(dy)) return
      const direction = dx < 0 ? 1 : -1
      if (canGo(direction)) onSwipe(direction)
    },
    onTouchCancel: () => {
      start.current = null
      setOffset(0)
    },
  }

  return { offset, swiping: offset !== 0, handlers }
}
