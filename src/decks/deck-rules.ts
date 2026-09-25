import type { CatalogCard } from '@/catalog/catalog-data'
import { DECK_SIZE, type DeckCard } from './deck'

// Deck Rules (RIB-23): dal Deck, dal catalogo e dalla Ban List ai Deck Warning. Codice puro.
// Regole di costruzione: Comprehensive Rules 5-1-2 (docs/Regole One Piece Card/):
//   5-1-2   esattamente 1 Leader e 50 carte;
//   5-1-2-1 il mazzo contiene solo Character, Event e Stage;
//   5-1-2-2 solo carte dei colori del Leader (una carta multicolore ha tutti i suoi colori, 2-3-5);
//   5-1-2-3 al massimo 4 carte con lo stesso numero;
//   5-1-2-4 il testo di alcune carte cambia queste regole (es. "any number of this card").
// Formato Standard: Block Number System, in vigore dal 1° aprile 2026 (un Block in meno ogni
// aprile); Extra: tutti i Block. I Deck Warning non bloccano mai il salvataggio.

export type DeckFormat = 'standard' | 'extra'
export const DECK_FORMATS: readonly DeckFormat[] = ['standard', 'extra']
export const MAX_COPIES = 4

/** Ban List (la gestirà l'Admin con RIB-29): per Card Code, parallel comprese. */
export interface BanList {
  banned: ReadonlySet<string>
  /** Card Code → copie massime. */
  restricted: ReadonlyMap<string, number>
  /** Coppie che non possono stare nello stesso Deck (Leader compreso). */
  pairs: readonly (readonly [string, string])[]
}

export const EMPTY_BAN_LIST: BanList = { banned: new Set(), restricted: new Map(), pairs: [] }

export type WarningCode =
  | 'noLeader'
  | 'size'
  | 'notDeckCard'
  | 'copies'
  | 'color'
  | 'block'
  | 'banned'
  | 'restricted'
  | 'bannedPair'
  | 'leaderMaxCost'
  | 'leaderMaxEventCost'
  | 'leaderOnlyType'

export interface DeckWarning {
  code: WarningCode
  /** Card Code coinvolti (vuoto per le regole sull'intero Deck). */
  cards: string[]
  /** Valori per il messaggio (es. numero di carte, costo, tipo). */
  params: Record<string, string | number>
}

export interface DeckInput {
  leaderCode: string | null
  cards: readonly DeckCard[]
}

export interface RulesOptions {
  format: DeckFormat
  banList: BanList
  today: Date
}

/**
 * Block minimo del formato Standard: la stagione inizia il 1° aprile; aprile 2026 → Block 2,
 * aprile 2027 → Block 3 e così via (Block Number System). Prima di aprile 2026 nessun limite.
 */
export function minimumStandardBlock(today: Date): number {
  const season = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1
  return Math.max(1, season - 2024)
}

/** Block legale in Standard: "X" (e i Block sconosciuti) sempre; i numeri dal minimo in su. */
export function isStandardLegal(block: string | null, today: Date): boolean {
  if (block === null || !/^\d+$/.test(block)) return true
  return Number(block) >= minimumStandardBlock(today)
}

const ANY_NUMBER = /you may have any number of this card in your deck/i
const LEADER_MAX_COST = /you cannot include cards with a cost of (\d+) or more in your deck/i
const LEADER_MAX_EVENT_COST = /you cannot include Events with a cost of (\d+) or more in your deck/i
const LEADER_ONLY_TYPE = /you can only include \{([^}]+)\} type cards in your deck/i

const DECK_CATEGORIES = new Set(['Character', 'Event', 'Stage'])

export function checkDeck(
  deck: DeckInput,
  catalog: ReadonlyMap<string, CatalogCard>,
  options: RulesOptions,
): DeckWarning[] {
  const warnings: DeckWarning[] = []
  const warn = (code: WarningCode, cards: string[] = [], params: DeckWarning['params'] = {}) => {
    warnings.push({ code, cards, params })
  }
  const leader = deck.leaderCode ? catalog.get(deck.leaderCode) : undefined
  const validLeader = leader?.category === 'Leader' ? leader : undefined
  const entries = deck.cards.flatMap((c) => {
    const card = catalog.get(c.cardCode)
    return card ? [{ card, quantity: c.quantity }] : []
  })
  const codesWhere = (test: (e: (typeof entries)[number]) => boolean) =>
    entries.filter(test).map((e) => e.card.cardCode)

  // 5-1-2: un Leader e 50 carte.
  if (!validLeader) warn('noLeader')
  const count = deck.cards.reduce((sum, c) => sum + c.quantity, 0)
  if (count !== DECK_SIZE) warn('size', [], { count, size: DECK_SIZE })

  // 5-1-2-1: nel mazzo niente Leader né DON!!.
  const notDeck = codesWhere((e) => !DECK_CATEGORIES.has(e.card.category))
  if (notDeck.length > 0) warn('notDeckCard', notDeck)

  // 5-1-2-3 e 5-1-2-4: al massimo 4 copie, salvo le carte "in qualsiasi numero".
  const tooMany = codesWhere(
    (e) => e.quantity > MAX_COPIES && !ANY_NUMBER.test(e.card.effect ?? ''),
  )
  if (tooMany.length > 0) warn('copies', tooMany, { max: MAX_COPIES })

  // 5-1-2-2: colori del Leader.
  if (validLeader) {
    const colors = new Set(validLeader.colors)
    const wrong = codesWhere(
      (e) => DECK_CATEGORIES.has(e.card.category) && !e.card.colors.some((c) => colors.has(c)),
    )
    if (wrong.length > 0) warn('color', wrong, { colors: validLeader.colors.join('/') })
  }

  // Block Number System (solo Standard), Leader compreso.
  if (options.format === 'standard') {
    const all = validLeader
      ? [validLeader, ...entries.map((e) => e.card)]
      : entries.map((e) => e.card)
    const illegal = all
      .filter((card) => !isStandardLegal(card.block, options.today))
      .map((card) => card.cardCode)
    if (illegal.length > 0) {
      warn('block', illegal, { block: minimumStandardBlock(options.today) })
    }
  }

  // Ban List: bandite, limitate, coppie.
  const inDeck = new Map(entries.map((e) => [e.card.cardCode, e.quantity]))
  if (validLeader) inDeck.set(validLeader.cardCode, (inDeck.get(validLeader.cardCode) ?? 0) + 1)
  const banned = [...inDeck.keys()].filter((code) => options.banList.banned.has(code))
  if (banned.length > 0) warn('banned', banned)
  for (const [code, max] of options.banList.restricted) {
    const quantity = inDeck.get(code) ?? 0
    if (quantity > max) warn('restricted', [code], { max })
  }
  for (const [a, b] of options.banList.pairs) {
    if (inDeck.has(a) && inDeck.has(b)) warn('bannedPair', [a, b])
  }

  // 5-1-2-4: restrizioni scritte sul Leader.
  if (validLeader?.effect) {
    const text = validLeader.effect
    const maxCost = LEADER_MAX_COST.exec(text)?.[1]
    if (maxCost) {
      const cost = Number(maxCost)
      const over = codesWhere((e) => (e.card.cost ?? 0) >= cost)
      if (over.length > 0) warn('leaderMaxCost', over, { cost })
    }
    const maxEventCost = LEADER_MAX_EVENT_COST.exec(text)?.[1]
    if (maxEventCost) {
      const cost = Number(maxEventCost)
      const over = codesWhere((e) => e.card.category === 'Event' && (e.card.cost ?? 0) >= cost)
      if (over.length > 0) warn('leaderMaxEventCost', over, { cost })
    }
    const onlyType = LEADER_ONLY_TYPE.exec(text)?.[1]
    if (onlyType) {
      const other = codesWhere((e) => !e.card.types.includes(onlyType))
      if (other.length > 0) warn('leaderOnlyType', other, { type: onlyType })
    }
  }

  return warnings
}

/** Le carte coinvolte in almeno un Deck Warning (per il segnale ⚠ nella lista del Deck). */
export function flaggedCards(warnings: readonly DeckWarning[]): Set<string> {
  return new Set(warnings.flatMap((w) => w.cards))
}

// ---- Statistiche del Deck ----

export const COST_BUCKETS = 11 // 0…9 e "10+"
export const COUNTER_VALUES = [0, 1000, 2000] as const

export interface DeckStats {
  /** Carte per costo: indice 0…9, l'ultimo è "10 o più". */
  costCurve: number[]
  categories: Record<string, number>
  /** Per colore (una carta multicolore conta per ogni suo colore). */
  colors: Record<string, number>
  /** Per valore di Counter: 0 (nessun Counter), 1000, 2000. */
  counters: Record<string, number>
  triggers: number
}

export function deckStats(
  cards: readonly DeckCard[],
  catalog: ReadonlyMap<string, CatalogCard>,
): DeckStats {
  const stats: DeckStats = {
    costCurve: Array.from({ length: COST_BUCKETS }, () => 0),
    categories: {},
    colors: {},
    counters: {},
    triggers: 0,
  }
  const add = (record: Record<string, number>, key: string, n: number) => {
    record[key] = (record[key] ?? 0) + n
  }
  for (const { cardCode, quantity } of cards) {
    const card = catalog.get(cardCode)
    if (!card) continue
    if (card.cost !== null) {
      const bucket = Math.min(Math.max(card.cost, 0), COST_BUCKETS - 1)
      stats.costCurve[bucket] = (stats.costCurve[bucket] ?? 0) + quantity
    }
    add(stats.categories, card.category, quantity)
    for (const color of card.colors) add(stats.colors, color, quantity)
    add(stats.counters, String(card.counter ?? 0), quantity)
    if (card.trigger !== null) stats.triggers += quantity
  }
  return stats
}
