// PROTOTIPO RIB-8 (usa e getta): tre varianti di stile sulla pagina del catalogo, scelte con ?variant=A|B|C.
// Si attiva solo con VITE_PROTOTYPE=true (deploy preview del branch prototype/rib-8). Non va su main.
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import './prototype.css'
import { VariantA, variantName as nameA } from './VariantA'
import { VariantB, variantName as nameB } from './VariantB'
import { VariantC, variantName as nameC } from './VariantC'

const VARIANTS = [
  { key: 'A', name: nameA, Component: VariantA },
  { key: 'B', name: nameB, Component: VariantB },
  { key: 'C', name: nameC, Component: VariantC },
] as const

function readVariant(): number {
  const key = new URLSearchParams(window.location.search).get('variant')?.toUpperCase()
  const index = VARIANTS.findIndex((v) => v.key === key)
  return index === -1 ? 0 : index
}

export function Prototype() {
  const [index, setIndex] = useState(readVariant)

  const go = useCallback((delta: number) => {
    setIndex((i) => {
      const next = (i + delta + VARIANTS.length) % VARIANTS.length
      const url = new URL(window.location.href)
      url.searchParams.set('variant', VARIANTS[next]?.key ?? 'A')
      window.history.replaceState(null, '', url)
      return next
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowLeft') go(-1)
      if (e.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [go])

  const current = VARIANTS[index] ?? VARIANTS[0]
  const { Component } = current

  return (
    <>
      <Component key={current.key} />
      <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+84px)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-fuchsia-600 p-1 text-white shadow-2xl ring-4 ring-fuchsia-600/25 lg:bottom-5">
        <button
          type="button"
          onClick={() => {
            go(-1)
          }}
          aria-label="Variante precedente"
          className="inline-flex size-9 items-center justify-center rounded-full hover:bg-white/20"
        >
          <ChevronLeft className="size-5" />
        </button>
        <span className="min-w-36 px-2 text-center text-sm font-semibold">
          {current.key} · {current.name}
        </span>
        <button
          type="button"
          onClick={() => {
            go(1)
          }}
          aria-label="Variante successiva"
          className="inline-flex size-9 items-center justify-center rounded-full hover:bg-white/20"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </>
  )
}
