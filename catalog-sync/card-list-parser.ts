import * as cheerio from 'cheerio'
import type { Cheerio } from 'cheerio'
import type { Element } from 'domhandler'

// Card List Parser: trasforma l'HTML di una pagina della Official Card List
// (https://en.onepiece-cardgame.com/cardlist/?series=<id>) in Set, Card e Printing.
// Codice puro: nessuna rete, nessun database.

export const CATEGORIES = ['Leader', 'Character', 'Event', 'Stage', 'DON!!'] as const
export type Category = (typeof CATEGORIES)[number]

export interface ParsedSet {
  /** Identificativo della serie sul sito ufficiale, es. 569101. */
  seriesId: number
  /** Codice del Set, es. "OP-01", "ST-01", "PRB-01". */
  code: string
  /** Nome del Set, es. "ROMANCE DAWN". */
  name: string
  /** Tipo di prodotto, es. "BOOSTER PACK"; null se il sito non lo indica. */
  productType: string | null
}

export interface ParsedCard {
  cardCode: string
  name: string
  category: Category
  /** Costo per Character, Event e Stage; null per i Leader. */
  cost: number | null
  /** Vita per i Leader; null per le altre Category. */
  life: number | null
  power: number | null
  counter: number | null
  attributes: string[]
  colors: string[]
  types: string[]
  /** Block di rotazione stampato sulla carta: un numero ("1", "2"…) oppure "X". */
  block: string | null
  effect: string | null
  trigger: string | null
}

export interface ParsedPrinting {
  /** Card Code più l'eventuale suffisso: `_pN` (parallel/alt-art) o `_rN` (ristampa). */
  printId: string
  cardCode: string
  rarity: string
}

export interface ParsedCardListPage {
  set: ParsedSet
  /** Una per Card Code. */
  cards: ParsedCard[]
  /** Una per Print ID. */
  printings: ParsedPrinting[]
}

export class CardListParseError extends Error {
  constructor(message: string, printId?: string) {
    super(printId ? `${printId}: ${message}` : message)
    this.name = 'CardListParseError'
  }
}

// Set senza codice tra parentesi quadre nel menu del sito.
const SET_CODES_WITHOUT_BRACKETS: Record<number, string> = {
  569901: 'PROMO',
  569801: 'OTHER',
}

const PRINT_ID = /^(?<cardCode>[A-Z0-9]+-\d+)(?:_[pr]\d+)?$/

export function isPrintId(value: string): boolean {
  return PRINT_ID.test(value)
}

const CATEGORY_BY_LABEL: Record<string, Category> = {
  LEADER: 'Leader',
  CHARACTER: 'Character',
  EVENT: 'Event',
  STAGE: 'Stage',
  'DON!!': 'DON!!',
}

export function parseCardListPage(html: string): ParsedCardListPage {
  const $ = cheerio.load(html)
  const set = parseSelectedSet($)

  const cards = new Map<string, ParsedCard>()
  const printings: ParsedPrinting[] = []
  const seenPrintIds = new Set<string>()

  $('dl.modalCol').each((_, element) => {
    const { card, printing } = parseCardBlock($, $(element))
    if (seenPrintIds.has(printing.printId)) {
      throw new CardListParseError('Print ID duplicato nella pagina', printing.printId)
    }
    seenPrintIds.add(printing.printId)
    printings.push(printing)

    // I dati della Card si prendono dalla Printing base se c'è, altrimenti dalla prima trovata.
    const isBasePrinting = printing.printId === printing.cardCode
    if (!cards.has(card.cardCode) || isBasePrinting) cards.set(card.cardCode, card)
  })

  if (printings.length === 0) throw new CardListParseError('Nessuna carta trovata nella pagina')

  return { set, cards: [...cards.values()], printings }
}

/**
 * Tutti i Set elencati nel menu della Official Card List, nell'ordine del sito.
 * Qualsiasi pagina della Card List contiene il menu completo.
 */
export function parseSeriesList(html: string): ParsedSet[] {
  const $ = cheerio.load(html)
  const sets = $('select#series option')
    .toArray()
    .filter((option) => ($(option).attr('value') ?? '') !== '')
    .map((option) => parseSetOption($(option)))

  if (sets.length === 0) throw new CardListParseError('Elenco dei Set non trovato')
  const codes = new Set(sets.map((set) => set.code))
  if (codes.size !== sets.length) throw new CardListParseError('Codici dei Set duplicati nel menu')
  return sets
}

function parseSelectedSet($: cheerio.CheerioAPI): ParsedSet {
  const option = $('select#series option[selected]').first()
  if (option.length === 0) throw new CardListParseError('Set selezionato non trovato')
  return parseSetOption(option)
}

function parseSetOption(option: Cheerio<Element>): ParsedSet {
  const seriesId = Number(option.attr('value'))
  if (!Number.isInteger(seriesId) || seriesId <= 0) {
    throw new CardListParseError('Identificativo del Set non valido')
  }

  // Il testo contiene un <br> letterale (codificato come entità nell'HTML).
  const label = normalizeSpaces(option.text().replace(/<br[^>]*>/gi, ' '))
  const match = /^(?<productType>.*?)\s*-(?<name>.+)-\s*\[(?<code>[^\]]+)\]$/.exec(label)

  if (match?.groups) {
    const { productType = '', name = '', code = '' } = match.groups
    return { seriesId, code: code.trim(), name: name.trim(), productType: productType || null }
  }

  const code = SET_CODES_WITHOUT_BRACKETS[seriesId]
  if (!code) throw new CardListParseError(`Formato del Set non riconosciuto: "${label}"`)
  return { seriesId, code, name: label, productType: null }
}

function parseCardBlock(
  $: cheerio.CheerioAPI,
  block: Cheerio<Element>,
): { card: ParsedCard; printing: ParsedPrinting } {
  const printId = block.attr('id') ?? ''
  const printIdMatch = PRINT_ID.exec(printId)
  if (!printIdMatch?.groups?.cardCode) {
    throw new CardListParseError('Print ID non riconosciuto', printId || '(vuoto)')
  }
  const cardCode = printIdMatch.groups.cardCode

  const info = block
    .find('.infoCol span')
    .map((_, span) => $(span).text().trim())
    .get()
  const [infoCode, rarity, categoryLabel] = info
  if (info.length !== 3 || !infoCode || !rarity || !categoryLabel) {
    throw new CardListParseError('Intestazione della carta non valida', printId)
  }
  if (infoCode !== cardCode) {
    throw new CardListParseError(`Card Code "${infoCode}" diverso dal Print ID`, printId)
  }

  const category = CATEGORY_BY_LABEL[categoryLabel]
  if (!category) throw new CardListParseError(`Category sconosciuta "${categoryLabel}"`, printId)

  const name = normalizeSpaces(block.find('.cardName').first().text())
  if (!name) throw new CardListParseError('Nome mancante', printId)

  // Il riquadro "cost" riporta "Life" per i Leader e "Cost" per le altre Category.
  const costBox = block.find('.backCol .cost').first()
  const costLabel = costBox.find('h3').text().trim()
  const costValue = parseOptionalInteger(fieldValue(costBox), printId, 'Cost/Life')

  // Il sito mostra "-" anche per i Character con potenza 0 (es. OP01-006 Otama).
  const power = parseOptionalInteger(fieldValue(block.find('.backCol .power')), printId, 'Power')

  const card: ParsedCard = {
    cardCode,
    name,
    category,
    cost: costLabel === 'Cost' ? costValue : null,
    life: costLabel === 'Life' ? costValue : null,
    power: category === 'Character' ? (power ?? 0) : power,
    counter: parseOptionalInteger(fieldValue(block.find('.backCol .counter')), printId, 'Counter'),
    attributes: splitList(block.find('.backCol .attribute i').text()),
    colors: splitList(fieldValue(block.find('.backCol .color'))),
    types: splitList(fieldValue(block.find('.backCol .feature'))),
    block: parseBlock(fieldValue(block.find('.backCol .block')), printId),
    effect: multilineText(block.find('.backCol .text')),
    trigger: multilineText(block.find('.backCol .trigger')),
  }

  return { card, printing: { printId, cardCode, rarity } }
}

/** Il testo di un riquadro senza la sua intestazione <h3>. */
function fieldValue(box: Cheerio<Element>): string {
  const clone = box.first().clone()
  clone.find('h3').remove()
  return normalizeSpaces(clone.text())
}

/** Testo su più righe: ogni <br> diventa un a capo. "-" o vuoto diventano null. */
function multilineText(box: Cheerio<Element>): string | null {
  if (box.length === 0) return null
  const clone = box.first().clone()
  clone.find('h3').remove()
  clone.find('br').replaceWith('\n')
  const text = clone
    .text()
    .split('\n')
    .map((line) => normalizeSpaces(line))
    .filter((line) => line !== '')
    .join('\n')
  return text === '' || text === '-' ? null : text
}

function parseBlock(value: string, printId: string): string | null {
  if (value === '' || value === '-') return null
  if (!/^(\d+|X)$/.test(value))
    throw new CardListParseError(`Block non valido: "${value}"`, printId)
  return value
}

function parseOptionalInteger(value: string, printId: string, field: string): number | null {
  if (value === '' || value === '-') return null
  if (!/^\d+$/.test(value))
    throw new CardListParseError(`${field} non numerico: "${value}"`, printId)
  return Number(value)
}

function splitList(value: string): string[] {
  return value
    .split('/')
    .map((item) => normalizeSpaces(item))
    .filter((item) => item !== '' && item !== '-')
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}
