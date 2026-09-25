import type { CatalogCard, CatalogPrinting } from './catalog-data'

// Ricerca e filtri del catalogo (RIB-15): logica pura, eseguita sul dispositivo.
// Filtri diversi si combinano in AND; più valori dello stesso filtro sono in OR.

export type Range = readonly [min: number | null, max: number | null]

export interface CatalogFilters {
  /** Testo libero: tutte le parole devono comparire in nome, codice, effetto, Trigger o Type. */
  q: string
  colors: string[]
  categories: string[]
  attributes: string[]
  types: string[]
  keywords: string[]
  /** Scorciatoie per gli effetti comuni (id di EFFECT_SHORTCUTS). */
  effects: string[]
  sets: string[]
  rarities: string[]
  blocks: string[]
  cost: Range
  power: Range
  counter: Range
  /** true = solo con Trigger, false = solo senza, null = indifferente. */
  trigger: boolean | null
  /** Una voce per ogni Printing invece che una per Card Code. */
  allPrintings: boolean
}

export const EMPTY_FILTERS: CatalogFilters = {
  q: '',
  colors: [],
  categories: [],
  attributes: [],
  types: [],
  keywords: [],
  effects: [],
  sets: [],
  rarities: [],
  blocks: [],
  cost: [null, null],
  power: [null, null],
  counter: [null, null],
  trigger: null,
  allPrintings: false,
}

export const COLORS = ['Red', 'Green', 'Blue', 'Purple', 'Black', 'Yellow'] as const
export const CATEGORIES = ['Leader', 'Character', 'Event', 'Stage', 'DON!!'] as const

/**
 * Scorciatoie per gli effetti comuni: ricerche nel testo inglese di effetto e Trigger.
 * `shows` è ciò che l'interfaccia mostra, perché i testi non sono standardizzati al 100%.
 */
export const EFFECT_SHORTCUTS = [
  { id: 'draw', pattern: /\bdraw\b/i, shows: 'draw' },
  { id: 'trash', pattern: /\btrash\b/i, shows: 'trash' },
  { id: 'ko', pattern: /\bK\.O\./, shows: 'K.O.' },
  { id: 'rest', pattern: /\brest\b/i, shows: 'rest' },
  {
    id: 'returnToHand',
    pattern: /\breturn\b[^.]*\bto (?:the owner's|its owner's|your) hand\b/i,
    shows: 'return … to … hand',
  },
  {
    id: 'addDon',
    pattern: /\bDON!! cards? from your DON!! deck\b/i,
    shows: 'DON!! … from your DON!! deck',
  },
  {
    id: 'lookTop',
    pattern: /\blook at (?:up to )?\d+ cards? from the top\b/i,
    shows: 'look at … from the top',
  },
  {
    id: 'playFromHand',
    pattern: /\bplay up to \d+\b[^.]*\bfrom your hand\b/i,
    shows: 'play up to … from your hand',
  },
  { id: 'powerUp', pattern: /\+\d+ power\b/i, shows: '+… power' },
  { id: 'powerDown', pattern: /[−-]\d+ power\b/i, shows: '−… power' },
  { id: 'life', pattern: /\bLife (?:area|cards?)\b/i, shows: 'Life' },
] as const

export type EffectShortcutId = (typeof EFFECT_SHORTCUTS)[number]['id']

export interface CatalogEntry {
  card: CatalogCard
  /** Printing da mostrare. */
  printing: CatalogPrinting
}

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

const searchIndex = new WeakMap<CatalogCard, string>()
function haystack(card: CatalogCard): string {
  let text = searchIndex.get(card)
  if (text === undefined) {
    text = normalize(
      [card.name, card.cardCode, card.effect ?? '', card.trigger ?? '', card.types.join(' ')].join(
        '\n',
      ),
    )
    searchIndex.set(card, text)
  }
  return text
}

const anyOf = (selected: readonly string[], values: readonly string[]) =>
  selected.length === 0 || values.some((v) => selected.includes(v))

function inRange([min, max]: Range, value: number | null): boolean {
  if (min === null && max === null) return true
  if (value === null) return false
  return (min === null || value >= min) && (max === null || value <= max)
}

function matchesCard(card: CatalogCard, f: CatalogFilters, words: string[]): boolean {
  if (words.length > 0) {
    const text = haystack(card)
    if (!words.every((w) => text.includes(w))) return false
  }
  if (!anyOf(f.colors, card.colors)) return false
  if (!anyOf(f.categories, [card.category])) return false
  if (!anyOf(f.attributes, card.attributes)) return false
  if (!anyOf(f.types, card.types)) return false
  if (!anyOf(f.keywords, card.keywords)) return false
  if (!anyOf(f.blocks, card.block === null ? [] : [card.block])) return false
  if (f.effects.length > 0) {
    const text = `${card.effect ?? ''}\n${card.trigger ?? ''}`
    const shortcuts = EFFECT_SHORTCUTS.filter((s) => f.effects.includes(s.id))
    if (!shortcuts.some((s) => s.pattern.test(text))) return false
  }
  if (!inRange(f.cost, card.cost)) return false
  if (!inRange(f.power, card.power)) return false
  // Nessun Counter conta come 0: "counter 0–0" trova le carte senza Counter.
  if (!inRange(f.counter, card.counter ?? 0)) return false
  if (f.trigger !== null && (card.trigger !== null) !== f.trigger) return false
  return true
}

const matchesPrinting = (p: CatalogPrinting, f: CatalogFilters) =>
  anyOf(f.sets, [p.setCode]) && anyOf(f.rarities, [p.rarity])

/** Applica ricerca e filtri al catalogo e restituisce le voci da mostrare, in ordine di Card Code. */
export function filterCatalog(cards: readonly CatalogCard[], f: CatalogFilters): CatalogEntry[] {
  const words = normalize(f.q).split(/\s+/).filter(Boolean)
  const entries: CatalogEntry[] = []
  for (const card of cards) {
    if (!matchesCard(card, f, words)) continue
    const printings = card.printings.filter((p) => matchesPrinting(p, f))
    if (printings.length === 0) continue
    if (f.allPrintings) {
      for (const printing of printings) entries.push({ card, printing })
    } else {
      // Una voce per Card: la base se passa i filtri, altrimenti la prima che li passa.
      const [first] = printings
      if (first) entries.push({ card, printing: first })
    }
  }
  return entries
}

/** Quanti filtri sono attivi (per il badge del pulsante Filtri; il testo libero escluso). */
export function countActiveFilters(f: CatalogFilters): number {
  const lists = [
    f.colors,
    f.categories,
    f.attributes,
    f.types,
    f.keywords,
    f.effects,
    f.sets,
    f.rarities,
    f.blocks,
  ]
  const ranges = [f.cost, f.power, f.counter]
  return (
    lists.filter((l) => l.length > 0).length +
    ranges.filter(([a, b]) => a !== null || b !== null).length +
    (f.trigger === null ? 0 : 1) +
    (f.allPrintings ? 1 : 0)
  )
}

/** Le scorciatoie degli effetti comuni che compaiono nel testo (effetto e Trigger) di una Card. */
export function effectsOf(card: CatalogCard): EffectShortcutId[] {
  const text = `${card.effect ?? ''}\n${card.trigger ?? ''}`
  return EFFECT_SHORTCUTS.filter((s) => s.pattern.test(text)).map((s) => s.id)
}

/**
 * "Cerca carte correlate" (RIB-41): stessi colori, tipi ed effetti comuni della Card. Per un
 * Leader si cercano le carte da mettere nel suo Deck (niente Leader né DON!!).
 */
export function relatedFilters(card: CatalogCard): CatalogFilters {
  return {
    ...EMPTY_FILTERS,
    colors: [...card.colors],
    types: [...card.types],
    effects: effectsOf(card),
    categories: card.category === 'Leader' ? ['Character', 'Event', 'Stage'] : [],
  }
}

// ---- URL: ogni ricerca si condivide copiando il link ----

const LIST_PARAMS = {
  colors: 'colore',
  categories: 'categoria',
  attributes: 'attributo',
  types: 'tipo',
  keywords: 'keyword',
  effects: 'effetto',
  sets: 'set',
  rarities: 'rarita',
  blocks: 'block',
} as const satisfies Partial<Record<keyof CatalogFilters, string>>

const RANGE_PARAMS = { cost: 'costo', power: 'potenza', counter: 'counter' } as const

function formatRange([min, max]: Range): string | null {
  if (min === null && max === null) return null
  return `${min === null ? '' : String(min)}-${max === null ? '' : String(max)}`
}

function parseRange(value: string | null): Range {
  const match = /^(\d*)-(\d*)$/.exec(value ?? '')
  if (!match) return [null, null]
  const toNumber = (s: string | undefined) => (s ? Number(s) : null)
  return [toNumber(match[1]), toNumber(match[2])]
}

export function filtersToSearchParams(f: CatalogFilters): URLSearchParams {
  const params = new URLSearchParams()
  if (f.q.trim()) params.set('q', f.q)
  for (const [key, param] of Object.entries(LIST_PARAMS) as [keyof typeof LIST_PARAMS, string][]) {
    for (const value of f[key]) params.append(param, value)
  }
  for (const [key, param] of Object.entries(RANGE_PARAMS) as [
    keyof typeof RANGE_PARAMS,
    string,
  ][]) {
    const value = formatRange(f[key])
    if (value !== null) params.set(param, value)
  }
  if (f.trigger !== null) params.set('trigger', f.trigger ? 'si' : 'no')
  if (f.allPrintings) params.set('printing', 'tutte')
  return params
}

export function filtersFromSearchParams(params: URLSearchParams): CatalogFilters {
  const list = (param: string) => [...new Set(params.getAll(param).filter(Boolean))]
  const trigger = params.get('trigger')
  return {
    q: params.get('q') ?? '',
    colors: list(LIST_PARAMS.colors),
    categories: list(LIST_PARAMS.categories),
    attributes: list(LIST_PARAMS.attributes),
    types: list(LIST_PARAMS.types),
    keywords: list(LIST_PARAMS.keywords),
    effects: list(LIST_PARAMS.effects),
    sets: list(LIST_PARAMS.sets),
    rarities: list(LIST_PARAMS.rarities),
    blocks: list(LIST_PARAMS.blocks),
    cost: parseRange(params.get(RANGE_PARAMS.cost)),
    power: parseRange(params.get(RANGE_PARAMS.power)),
    counter: parseRange(params.get(RANGE_PARAMS.counter)),
    trigger: trigger === 'si' ? true : trigger === 'no' ? false : null,
    allPrintings: params.get('printing') === 'tutte',
  }
}

/** Valori disponibili per i filtri, ricavati dal catalogo; le Keyword dalla più frequente. */
export function catalogFacets(cards: readonly CatalogCard[]) {
  const count = (values: Iterable<string>) => {
    const counts = new Map<string, number>()
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
    return counts
  }
  const byFrequency = (counts: Map<string, number>) =>
    [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([v]) => v)
  const alphabetical = (values: Iterable<string>) =>
    [...new Set(values)].sort((a, b) => a.localeCompare(b))

  return {
    keywords: byFrequency(count(cards.flatMap((c) => c.keywords))),
    attributes: byFrequency(count(cards.flatMap((c) => c.attributes))),
    types: alphabetical(cards.flatMap((c) => c.types)),
    rarities: byFrequency(count(cards.flatMap((c) => c.printings.map((p) => p.rarity)))),
    blocks: alphabetical(cards.flatMap((c) => (c.block === null ? [] : [c.block]))),
  }
}
