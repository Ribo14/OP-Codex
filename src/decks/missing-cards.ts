import type { CatalogCard } from '@/catalog/catalog-data'
import { cardCodeOf, type CollectionEntry } from '@/collection/collection'
import type { DeckCard } from './deck'
import { formatDeckList } from './deck-list'

// Missing Cards (RIB-25): cosa manca nella Collection per giocare un Deck dal vivo. Per ogni Card
// Code si sommano tutte le Printing (base, parallel, ristampe) e tutte le lingue possedute.
// Conta anche il Leader: serve una copia anche di lui.

export interface MissingRow {
  cardCode: string
  required: number
  owned: number
  missing: number
}

/** Copie possedute per Card Code, sommando Printing e lingue. */
export function ownedByCard(entries: readonly CollectionEntry[]): Map<string, number> {
  const owned = new Map<string, number>()
  for (const e of entries) {
    const code = cardCodeOf(e.printId)
    owned.set(code, (owned.get(code) ?? 0) + e.quantity)
  }
  return owned
}

/** Tutte le carte del Deck (Leader per primo) con richieste, possedute e mancanti. */
export function deckOwnership(
  leaderCode: string | null,
  cards: readonly Pick<DeckCard, 'cardCode' | 'quantity'>[],
  entries: readonly CollectionEntry[],
): MissingRow[] {
  const owned = ownedByCard(entries)
  const required = [...(leaderCode ? [{ cardCode: leaderCode, quantity: 1 }] : []), ...cards]
  return required.map(({ cardCode, quantity }) => {
    const have = owned.get(cardCode) ?? 0
    return { cardCode, required: quantity, owned: have, missing: Math.max(0, quantity - have) }
  })
}

/** Solo le carte che mancano. */
export function missingCards(rows: readonly MissingRow[]): MissingRow[] {
  return rows.filter((r) => r.missing > 0)
}

export function missingTotal(rows: readonly MissingRow[]): number {
  return rows.reduce((sum, r) => sum + r.missing, 0)
}

/** Le mancanti con il nome della carta, Leader per primo; le carte sparite dal catalogo si saltano. */
function missingWithCards(
  leaderCode: string | null,
  rows: readonly MissingRow[],
  catalog: ReadonlyMap<string, CatalogCard>,
): { card: CatalogCard; missing: number }[] {
  const missing = missingCards(rows)
  const ordered = [
    ...missing.filter((r) => r.cardCode === leaderCode),
    ...missing.filter((r) => r.cardCode !== leaderCode),
  ]
  return ordered.flatMap((r) => {
    const card = catalog.get(r.cardCode)
    return card ? [{ card, missing: r.missing }] : []
  })
}

/**
 * Per i Wants di Cardmarket ("Aggiungi una lista"): "3x Roronoa Zoro OP01-025", il formato della
 * guida di Cardmarket per One Piece; senza espansione vale qualunque versione della carta.
 */
export function cardmarketWantsText(
  leaderCode: string | null,
  rows: readonly MissingRow[],
  catalog: ReadonlyMap<string, CatalogCard>,
): string {
  return missingWithCards(leaderCode, rows, catalog)
    .map(({ card, missing }) => `${String(missing)}x ${card.name} ${card.cardCode}`)
    .join('\n')
}

/**
 * Il codice dell'espansione su CardTrader: quello salvato dal job (irregolare: op01, op-14,
 * eb-01, promo…) senza trattini, perché l'importazione del testo scarta le righe con il trattino
 * nel codice (provato il 2026-09-27); senza dati, promo per le P e il prefisso in minuscolo.
 */
function cardtraderExpansion(card: CatalogCard): string {
  const saved = card.printings[0]?.cardtrader?.expansion
  if (saved) return saved.replaceAll('-', '')
  const prefix = card.cardCode.split('-')[0] ?? ''
  return prefix === 'P' ? 'promo' : prefix.toLowerCase()
}

/**
 * Per le wishlist di CardTrader ("Incolla testo", formato MTGA): "3 Roronoa Zoro (op01) 025".
 * Il solo nome non basta (tante carte diverse si chiamano uguale): servono espansione e numero;
 * il numero solo come cifre, perché "OP01-025" intero viene scartato dall'importazione.
 */
export function cardtraderWishlistText(
  leaderCode: string | null,
  rows: readonly MissingRow[],
  catalog: ReadonlyMap<string, CatalogCard>,
): string {
  return missingWithCards(leaderCode, rows, catalog)
    .map(({ card, missing }) => {
      const number = card.cardCode.split('-')[1] ?? ''
      return `${String(missing)} ${card.name} (${cardtraderExpansion(card)}) ${number}`
    })
    .join('\n')
}

/**
 * "Copia lista mancanti": le copie che mancano nello stesso formato della Deck List, importabile;
 * il Leader compare solo se manca anche lui.
 */
export function missingListText(
  leaderCode: string | null,
  rows: readonly MissingRow[],
  catalog: ReadonlyMap<string, CatalogCard>,
): string {
  const missing = missingCards(rows)
  const leaderMissing = leaderCode !== null && missing.some((r) => r.cardCode === leaderCode)
  return formatDeckList(
    leaderMissing ? leaderCode : null,
    missing
      .filter((r) => r.cardCode !== leaderCode)
      .map((r) => ({ cardCode: r.cardCode, quantity: r.missing })),
    catalog,
  )
}
