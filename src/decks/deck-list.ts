import type { CatalogCard } from '@/catalog/catalog-data'
import type { DeckCard } from './deck'

// Deck List Codec (RIB-24): il Deck come testo, una riga per carta nel formato "4xOP01-016"
// (quello di OPTCG Sim e dei tornei). Codice puro. La Printing non fa parte del formato: le
// parallel si leggono come la loro Card, e all'importazione si mostra la base.

export interface ParsedLine {
  cardCode: string
  quantity: number
}

export type LineProblem = 'format' | 'unknown' | 'extraLeader' | 'notDeckCard'

export interface ListError {
  /** Numero di riga, da 1. */
  line: number
  text: string
  problem: LineProblem
}

export interface ParsedDeckList {
  leaderCode: string | null
  cards: ParsedLine[]
  errors: ListError[]
}

const CODE = String.raw`([A-Za-z0-9]+-\d+)(?:_[pPrR]\d+)?`
// "4xOP01-016", "4 x OP01-016", "4 OP01-016", "4×OP01-016", anche con il nome dopo il codice.
const QUANTITY_FIRST = new RegExp(String.raw`^(\d+)\s*[xX×]?\s*${CODE}(?:\s+.*)?$`)
// "OP01-016 x4", "OP01-016 x 4", "OP01-016 ×4".
const QUANTITY_LAST = new RegExp(String.raw`^${CODE}\s*[xX×]\s*(\d+)$`)
// "OP01-001" da solo: una copia (tipico della riga del Leader).
const CODE_ONLY = new RegExp(String.raw`^${CODE}$`)

function readLine(text: string): ParsedLine | null {
  let match = QUANTITY_FIRST.exec(text)
  if (match?.[1] && match[2])
    return { quantity: Number(match[1]), cardCode: match[2].toUpperCase() }
  match = QUANTITY_LAST.exec(text)
  if (match?.[1] && match[2])
    return { cardCode: match[1].toUpperCase(), quantity: Number(match[2]) }
  match = CODE_ONLY.exec(text)
  if (match?.[1]) return { cardCode: match[1].toUpperCase(), quantity: 1 }
  return null
}

/**
 * Testo → Deck. Il primo Leader diventa il Leader del Deck; le righe che non si leggono o con un
 * codice inesistente restano negli errori, con il numero di riga, senza scartare le altre.
 * Righe vuote e commenti ("#", "//") si ignorano; righe ripetute si sommano.
 */
export function parseDeckList(
  text: string,
  catalog: ReadonlyMap<string, CatalogCard>,
): ParsedDeckList {
  const errors: ListError[] = []
  const quantities = new Map<string, number>()
  let leaderCode: string | null = null

  text.split(/\r?\n/).forEach((raw, index) => {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('//')) return
    const fail = (problem: LineProblem) => {
      errors.push({ line: index + 1, text: line, problem })
    }
    const parsed = readLine(line)
    if (!parsed || parsed.quantity < 1) {
      fail('format')
      return
    }
    const card = catalog.get(parsed.cardCode)
    if (!card) {
      fail('unknown')
      return
    }
    if (card.category === 'Leader') {
      if (leaderCode === null) leaderCode = card.cardCode
      else if (leaderCode !== card.cardCode) fail('extraLeader')
      return
    }
    if (card.category === 'DON!!') {
      fail('notDeckCard')
      return
    }
    quantities.set(card.cardCode, (quantities.get(card.cardCode) ?? 0) + parsed.quantity)
  })

  return {
    leaderCode,
    cards: [...quantities].map(([cardCode, quantity]) => ({ cardCode, quantity })),
    errors,
  }
}

/** Deck → testo: il Leader per primo ("1x…"), poi le carte per costo e Card Code. */
export function formatDeckList(
  leaderCode: string | null,
  cards: readonly Pick<DeckCard, 'cardCode' | 'quantity'>[],
  catalog: ReadonlyMap<string, CatalogCard>,
): string {
  const cost = (code: string) => catalog.get(code)?.cost ?? 0
  const sorted = [...cards].sort(
    (a, b) =>
      cost(a.cardCode) - cost(b.cardCode) ||
      a.cardCode.localeCompare(b.cardCode, 'en', { numeric: true }),
  )
  const lines = sorted.map((c) => `${String(c.quantity)}x${c.cardCode}`)
  return [...(leaderCode ? [`1x${leaderCode}`] : []), ...lines].join('\n')
}
