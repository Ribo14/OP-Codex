import type {
  ParsedCard,
  ParsedCardListPage,
  ParsedPrinting,
  ParsedSet,
} from './card-list-parser.ts'

export interface CatalogPrinting extends ParsedPrinting {
  seriesId: number
}

export interface CatalogCard extends ParsedCard {
  /** Keyword dell'effetto e del Trigger, in ordine di apparizione (es. ["Blocker", "On Play"]). */
  keywords: string[]
}

// Una sequenza di termini tra parentesi quadre, separati da spazi, "/", "," o "and".
const BRACKET_RUN = String.raw`(?:\[[^\]]*\](?:\s*(?:\/|,|\band\b|\bor\b)?\s*))+`
const LEADING_RUN = new RegExp(String.raw`^\s*(${BRACKET_RUN})`)
const GAINS_RUN = new RegExp(String.raw`\bgains?\s+(${BRACKET_RUN})`, 'gi')

/**
 * Keyword possedute da una Card, in ordine di apparizione.
 *
 * Il sito usa le parentesi quadre per tre cose diverse:
 * - Keyword che la carta ha: in apertura di un'abilità ("[Blocker] (…)", "[On Play]/[When Attacking] …")
 *   o ottenute ("This Character gains [Rush]") → contano;
 * - Keyword solo citate ("cannot activate [Blocker]", "with a [Trigger]") → non contano;
 * - nomi di altre carte ("other than [Nami]") → non contano.
 */
export function extractKeywords(texts: readonly (string | null)[], cardNames: ReadonlySet<string>) {
  const keywords: string[] = []
  const add = (run: string) => {
    for (const match of run.matchAll(/\[([^\]]*)\]/g)) {
      const term = (match[1] ?? '').replace(/\s+/g, ' ').trim()
      if (term !== '' && !cardNames.has(term) && !keywords.includes(term)) keywords.push(term)
    }
  }

  for (const text of texts) {
    // Un'abilità per riga; a volte manca l'a capo dopo il testo di richiamo tra parentesi tonde.
    const abilities = (text ?? '').split(/\n|\)\s*(?=\[)/)
    for (const ability of abilities) {
      const leading = LEADING_RUN.exec(ability)
      if (leading?.[1]) add(leading[1])
      for (const gained of ability.matchAll(GAINS_RUN)) add(gained[1] ?? '')
    }
  }
  return keywords
}

/** Il catalogo pronto da salvare: nessun Set, Card o Printing ripetuti. */
export interface MergedCatalog {
  sets: ParsedSet[]
  cards: CatalogCard[]
  printings: CatalogPrinting[]
  /** Print ID trovati in più di un Set: vale il primo per series_id. */
  duplicatePrintIds: string[]
}

/**
 * Unisce le pagine di più Set in un catalogo coerente e deterministico:
 * - una Card per Card Code, con i dati presi dalla Printing base (senza suffisso) se esiste,
 *   altrimenti dal Set con series_id più basso: così una ristampa con testo diverso
 *   non sovrascrive la Card a ogni esecuzione;
 * - una Printing per Print ID, collegata al primo Set (per series_id) in cui compare.
 */
export function mergeCatalogPages(pages: readonly ParsedCardListPage[]): MergedCatalog {
  const ordered = [...pages].sort((a, b) => a.set.seriesId - b.set.seriesId)

  const sets = new Map<number, ParsedSet>()
  const cards = new Map<string, { card: ParsedCard; fromBase: boolean }>()
  const printings = new Map<string, CatalogPrinting>()
  const duplicatePrintIds = new Set<string>()

  for (const page of ordered) {
    if (sets.has(page.set.seriesId)) continue
    sets.set(page.set.seriesId, page.set)

    const basePrintIds = new Set(
      page.printings.filter((p) => p.printId === p.cardCode).map((p) => p.cardCode),
    )
    for (const card of page.cards) {
      const fromBase = basePrintIds.has(card.cardCode)
      const current = cards.get(card.cardCode)
      if (!current || (fromBase && !current.fromBase)) cards.set(card.cardCode, { card, fromBase })
    }

    for (const printing of page.printings) {
      if (printings.has(printing.printId)) {
        duplicatePrintIds.add(printing.printId)
        continue
      }
      printings.set(printing.printId, { ...printing, seriesId: page.set.seriesId })
    }
  }

  const cardNames = new Set([...cards.values()].map((entry) => entry.card.name))

  return {
    sets: [...sets.values()],
    cards: [...cards.values()].map(({ card }) => ({
      ...card,
      keywords: extractKeywords([card.effect, card.trigger], cardNames),
    })),
    printings: [...printings.values()],
    duplicatePrintIds: [...duplicatePrintIds].sort(),
  }
}
