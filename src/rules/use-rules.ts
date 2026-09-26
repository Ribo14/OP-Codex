import { useEffect, useState } from 'react'
import type { RulesDocument } from './rules-text'

// Il regolamento estratto (RIB-53) si carica a parte, solo quando serve: resta fuori dal bundle
// principale, e il service worker lo mette comunque in cache per l'offline.

let cached: RulesDocument | null = null

export function useRulesDocument(): RulesDocument | null {
  const [doc, setDoc] = useState(cached)
  useEffect(() => {
    if (cached) return
    let active = true
    void import('./comprehensive-rules.json').then((module) => {
      cached = module.default
      if (active) setDoc(cached)
    })
    return () => {
      active = false
    }
  }, [])
  return doc
}
