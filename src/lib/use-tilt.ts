import { useCallback, useRef } from 'react'
import type { PointerEvent } from 'react'

// Esperimento Grand Line: la carta sotto il mouse si inclina verso il puntatore e mostra un
// riflesso olografico (classe .holo in index.css). Un solo gestore sul contenitore, non uno per
// carta: la griglia ne mostra centinaia. Solo mouse e penna: col dito il movimento è lo scorrimento.

const MAX_DEG = 12

function reset(el: HTMLElement) {
  el.removeAttribute('data-tilting')
  for (const name of ['--rx', '--ry', '--mx', '--my']) el.style.removeProperty(name)
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** Gestori da mettere sul contenitore delle carte con la classe `.holo`. */
export function useTilt() {
  const current = useRef<HTMLElement | null>(null)

  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'touch' || prefersReducedMotion()) return
    const el = (e.target as Element).closest<HTMLElement>('.holo')
    if (el !== current.current) {
      if (current.current) reset(current.current)
      current.current = el
    }
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.dataset.tilting = ''
    el.style.setProperty('--ry', `${((x - 0.5) * MAX_DEG).toFixed(2)}deg`)
    el.style.setProperty('--rx', `${((0.5 - y) * MAX_DEG).toFixed(2)}deg`)
    el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
    el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
  }, [])

  const onPointerLeave = useCallback(() => {
    if (current.current) reset(current.current)
    current.current = null
  }, [])

  return { onPointerMove, onPointerLeave }
}
