import type { Catalog } from '@/catalog/catalog-data'
import { formatDeckList } from '@/decks/deck-list'
import type { ZipEntry } from '@/lib/zip'

// Esporta i miei dati (RIB-28): portabilità (GDPR) e backup personale. Codice puro: riceve i
// dati già letti dal server e restituisce i file dell'archivio. Il formato è descritto in
// docs/export-dati.md: chi aggiunge dati personali nuovi (amici, prezzi…) li aggiunge anche qui.

/** Versione del formato: aumenta se cambia la forma dei file, non se se ne aggiungono. */
export const EXPORT_VERSION = 1

export interface ExportProfile {
  username: string
  email: string | null
  createdAt: string
  updatedAt: string
}

export interface ExportCollectionEntry {
  printId: string
  language: string
  quantity: number
  createdAt: string
  updatedAt: string
}

export interface ExportDeck {
  id: string
  name: string
  leaderCode: string
  leaderPrintId: string | null
  format: string
  visibility: string
  /** Share Link attivo, se c'è. */
  shareLink: string | null
  createdAt: string
  updatedAt: string
  cards: { cardCode: string; quantity: number; printId: string | null }[]
}

export interface ExportData {
  exportedAt: string
  profile: ExportProfile
  collection: ExportCollectionEntry[]
  decks: ExportDeck[]
}

// ---- CSV della Collection ----

const BOM = String.fromCharCode(0xfeff)
const CSV_HEADER = ['Print ID', 'Card Code', 'Nome', 'Set', 'Nome del Set', 'Lingua', 'Quantità']

/**
 * Una cella CSV. Il separatore è ";" (quello che Excel in italiano si aspetta; Google Sheets lo
 * riconosce da solo). Il testo che inizia come una formula si neutralizza con un apice, così
 * aprire il file non esegue nulla.
 */
export function csvCell(value: string | number): string {
  if (typeof value === 'number') return String(value)
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
}

/** La Collection in CSV: UTF-8 con BOM (Excel altrimenti sbaglia gli accenti), righe CRLF. */
export function collectionCsv(entries: readonly ExportCollectionEntry[], catalog: Catalog): string {
  const byPrint = new Map(
    catalog.cards.flatMap((card) => card.printings.map((p) => [p.printId, { card, p }] as const)),
  )
  const setNames = new Map(catalog.sets.map((s) => [s.code, s.name]))
  const sorted = [...entries].sort(
    (a, b) =>
      a.printId.localeCompare(b.printId, 'en', { numeric: true }) ||
      a.language.localeCompare(b.language),
  )
  const rows = sorted.map((e) => {
    const found = byPrint.get(e.printId)
    const setCode = found?.p.setCode ?? ''
    return [
      e.printId,
      found?.card.cardCode ?? e.printId.split('_')[0] ?? e.printId,
      found?.card.name ?? '',
      setCode,
      setNames.get(setCode) ?? '',
      e.language,
      e.quantity,
    ]
  })
  return `${BOM}${[CSV_HEADER, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')}\r\n`
}

// ---- Nomi dei file ----

/** Un nome di file valido ovunque (Windows compreso), dal nome del Deck. */
export function safeFileName(name: string): string {
  const cleaned = Array.from(name)
    .map((ch) => (ch.charCodeAt(0) < 32 || '<>:"/\\|?*'.includes(ch) ? '_' : ch))
    .join('')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 60)
  return cleaned || 'Mazzo'
}

/** Un nome per ogni Deck, senza doppioni ("Rufy", "Rufy (2)"). */
function uniqueNames(names: readonly string[]): string[] {
  const used = new Set<string>()
  return names.map((name) => {
    const base = safeFileName(name)
    let candidate = base
    for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${base} (${String(n)})`
    used.add(candidate.toLowerCase())
    return candidate
  })
}

// ---- Archivio ----

const README = (data: ExportData) => `OP-Codex - i tuoi dati
Esportati il ${data.exportedAt} per @${data.profile.username}.

profilo.json     Username, email e date dell'account.
collezione.csv   La Collection: una riga per Printing e lingua (separatore ";", UTF-8).
mazzi.json       Tutti i mazzi con le carte (Card Code, copie, Printing scelta).
mazzi/*.txt      Ogni mazzo come lista "4xOP01-016", da importare in OP-Codex o in OPTCG Sim.

Versione del formato: ${String(EXPORT_VERSION)}.
`

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`

/** I file dell'archivio "Esporta i miei dati". */
export function exportFiles(data: ExportData, catalog: Catalog): ZipEntry[] {
  const meta = { version: EXPORT_VERSION, exportedAt: data.exportedAt }
  const cardsByCode = new Map(catalog.cards.map((card) => [card.cardCode, card]))
  const names = uniqueNames(data.decks.map((d) => d.name))
  return [
    { name: 'LEGGIMI.txt', content: README(data) },
    { name: 'profilo.json', content: json({ ...meta, profile: data.profile }) },
    { name: 'collezione.csv', content: collectionCsv(data.collection, catalog) },
    { name: 'mazzi.json', content: json({ ...meta, decks: data.decks }) },
    ...data.decks.map((deck, i) => ({
      name: `mazzi/${names[i] ?? 'Mazzo'}.txt`,
      content: `${formatDeckList(deck.leaderCode, deck.cards, cardsByCode)}\n`,
    })),
  ]
}

/** Nome dell'archivio: op-codex-<username>-<data>.zip */
export function exportFileName(data: ExportData): string {
  return `op-codex-${safeFileName(data.profile.username)}-${data.exportedAt.slice(0, 10)}.zip`
}
