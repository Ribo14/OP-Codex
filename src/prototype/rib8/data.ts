// PROTOTIPO RIB-8 (usa e getta): dati in sola lettura per le varianti di stile.
import { useEffect, useRef, useState } from 'react'
import { getSupabase } from '@/lib/supabase'

export interface ProtoSet {
  seriesId: number
  code: string
  name: string
  productType: string | null
}

export interface ProtoCard {
  cardCode: string
  name: string
  category: string
  cost: number | null
  life: number | null
  power: number | null
  counter: number | null
  colors: string[]
  attributes: string[]
  types: string[]
  block: string | null
  effect: string | null
  trigger: string | null
  /** Printing mostrata nella griglia (la base se c'è). */
  printId: string
  rarity: string
  hasImage: boolean
}

export interface ProtoPrinting {
  printId: string
  rarity: string
  hasImage: boolean
  setCode: string
  setName: string
}

/** EB-01: il primo Set con tutte le immagini già su Storage. */
export const DEFAULT_SERIES_ID = 569201

export async function fetchSets(): Promise<ProtoSet[]> {
  const { data, error } = await getSupabase()
    .from('sets')
    .select('series_id, code, name, product_type')
    .order('code')
  if (error) throw new Error(error.message)
  return data.map((s) => ({
    seriesId: s.series_id,
    code: s.code,
    name: s.name,
    productType: s.product_type,
  }))
}

export async function fetchSetCards(seriesId: number): Promise<ProtoCard[]> {
  const { data, error } = await getSupabase()
    .from('printings')
    .select(
      'print_id, card_code, rarity, image_synced_at, cards(name, category, cost, life, power, counter, colors, attributes, types, block, effect, trigger)',
    )
    .eq('series_id', seriesId)
    .order('print_id')
  if (error) throw new Error(error.message)

  const byCard = new Map<string, ProtoCard>()
  for (const row of data) {
    const isBase = row.print_id === row.card_code
    if (byCard.has(row.card_code) && !isBase) continue
    const c = row.cards
    byCard.set(row.card_code, {
      cardCode: row.card_code,
      name: c.name,
      category: c.category,
      cost: c.cost,
      life: c.life,
      power: c.power,
      counter: c.counter,
      colors: c.colors,
      attributes: c.attributes,
      types: c.types,
      block: c.block,
      effect: c.effect,
      trigger: c.trigger,
      printId: row.print_id,
      rarity: row.rarity,
      hasImage: row.image_synced_at !== null,
    })
  }
  return [...byCard.values()].sort((a, b) => a.cardCode.localeCompare(b.cardCode))
}

export async function fetchCardPrintings(cardCode: string): Promise<ProtoPrinting[]> {
  const { data, error } = await getSupabase()
    .from('printings')
    .select('print_id, rarity, image_synced_at, sets(code, name)')
    .eq('card_code', cardCode)
    .order('print_id')
  if (error) throw new Error(error.message)
  return data.map((p) => ({
    printId: p.print_id,
    rarity: p.rarity,
    hasImage: p.image_synced_at !== null,
    setCode: p.sets.code,
    setName: p.sets.name,
  }))
}

/** ?card=EB01-001 apre subito il dettaglio di quella Card (utile per confrontare le varianti). */
export function useInitialCard(cards: Loaded<ProtoCard[]>, open: (card: ProtoCard) => void) {
  const done = useRef(false)
  useEffect(() => {
    if (done.current || cards.status !== 'ready') return
    done.current = true
    const code = new URLSearchParams(window.location.search).get('card')?.toUpperCase()
    const card = code ? cards.data.find((c) => c.cardCode === code) : undefined
    if (card) open(card)
  }, [cards, open])
}

type Loaded<T> =
  { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

/** Caricamento minimo per il prototipo: nessuna cache, nessun retry. */
export function useLoad<T>(key: string | null, load: () => Promise<T>): Loaded<T> {
  const [state, setState] = useState<{ key: string; value: Loaded<T> } | null>(null)
  useEffect(() => {
    if (key === null) return
    let active = true
    load().then(
      (data) => {
        if (active) setState({ key, value: { status: 'ready', data } })
      },
      (e: unknown) => {
        if (active) setState({ key, value: { status: 'error', message: String(e) } })
      },
    )
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prototipo: si ricarica solo al cambio di key
  }, [key])
  return state?.key === key ? state.value : { status: 'loading' }
}
