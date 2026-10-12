import type postgres from 'postgres'
import { isPrintId, type Category, type ParsedCard } from './card-list-parser.ts'
import { extractKeywords } from './catalog-merge.ts'

// Preview Sync (ADR-0016): le carte dei Set non ancora nella Official Card List, prese da
// OPTCG Leaks (un file JSON per Set). Restano "anteprime" finché il Catalog Sync non trova la
// stessa Card sul sito ufficiale e la sostituisce (retirePreviews in catalog-store.ts).

export const PREVIEW_SITE = 'https://images.optcgleaks.com'

/** Serie dei Set e quanti numeri provare dopo l'ultimo Set ufficiale di ciascuna. */
const SERIES = ['OP', 'EB', 'ST', 'PRB'] as const
export const LOOKAHEAD = 4

/**
 * I Set da cercare sul sito delle anteprime: per ogni serie i LOOKAHEAD numeri dopo l'ultimo
 * Set ufficiale. I codici ufficiali possono contenere più serie (es. "OP15-EB04").
 * Restituisce gli id del sito, es. "eb05".
 */
export function candidateSets(officialSetCodes: readonly string[]): string[] {
  const latest = new Map<string, number>(SERIES.map((s) => [s, 0]))
  for (const code of officialSetCodes) {
    for (const match of code.toUpperCase().matchAll(/(PRB|OP|EB|ST)-?(\d+)/g)) {
      const series = match[1] ?? ''
      latest.set(series, Math.max(latest.get(series) ?? 0, Number(match[2])))
    }
  }
  return SERIES.flatMap((series) =>
    Array.from({ length: LOOKAHEAD }, (_, i) => {
      const n = (latest.get(series) ?? 0) + i + 1
      return `${series.toLowerCase()}${String(n).padStart(2, '0')}`
    }),
  )
}

/** "EB05" → "EB-05", come i codici dei Set ufficiali. */
export function previewSetCode(siteId: string): string {
  const match = /^([A-Z]+)(\d+)$/.exec(siteId.toUpperCase())
  if (!match) throw new Error(`Id di Set non valido: ${siteId}`)
  return `${match[1] ?? ''}-${match[2] ?? ''}`
}

export interface PreviewPrinting {
  printId: string
  rarity: string
  /** Id dell'immagine sul sito di origine. */
  image: string
}

export interface PreviewCard extends ParsedCard {
  keywords: string[]
  /** Chi ha tradotto il testo; null se il sito non lo dice. */
  credit: string | null
  printings: PreviewPrinting[]
}

export interface PreviewSet {
  /** Id sul sito di origine, es. "eb05". */
  siteId: string
  /** Codice come quelli ufficiali, es. "EB-05". */
  code: string
  name: string
  cards: PreviewCard[]
}

const CATEGORY: Record<string, Category> = {
  LEADER: 'Leader',
  CHARACTER: 'Character',
  EVENT: 'Event',
  STAGE: 'Stage',
  DON: 'DON!!',
}

const ENTITIES: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&amp;': '&',
}

/** Testo semplice: entità HTML decodificate, spazi in ordine; vuoto o "-" diventa null. */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const decoded = value
    .replace(/&(?:lt|gt|quot|#39|apos|amp);/g, (entity) => ENTITIES[entity] ?? entity)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n')
  return decoded === '' || decoded === '-' ? null : decoded
}

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.flatMap((v) => {
        const t = text(v)
        return t === null ? [] : [t]
      })
    : []

/** Una stringa così com'è; qualsiasi altro valore diventa vuoto. */
const str = (value: unknown): string => (typeof value === 'string' ? value : '')

/** Un intero da un numero o da un testo come "+1000"; altrimenti null. */
function integer(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null
  const digits = str(value).trim().replace(/^\+/, '')
  return /^-?\d+$/.test(digits) ? Number(digits) : null
}

/** Solo lettere minuscole, cifre, "_" e "-": l'id finisce nell'URL dell'immagine. */
const IMAGE_ID = /^[a-z0-9_-]{1,80}$/

/** Una carta del JSON nel formato del catalogo; null se manca qualcosa di essenziale. */
function parseCard(raw: unknown, warn: (message: string) => void): PreviewCard | null {
  if (typeof raw !== 'object' || raw === null) return null
  const c = raw as Record<string, unknown>
  const cardCode = str(c.id).toUpperCase()
  const name = text(c.name)
  const category = CATEGORY[str(c.category).toUpperCase()]
  if (!isPrintId(cardCode) || cardCode.includes('_') || !name || !category) {
    warn(`Carta scartata: ${JSON.stringify(c.id)} (codice, nome o categoria non validi)`)
    return null
  }
  const rarity = text(c.rarity) ?? '-'
  const images = Array.isArray(c.images) ? c.images : []
  const printings = images.flatMap((image: unknown, i) => {
    const id = str((image as Record<string, unknown> | null)?.id)
    if (!IMAGE_ID.test(id)) {
      warn(`${cardCode}: immagine scartata ${JSON.stringify(id)}`)
      return []
    }
    // La prima immagine è la stampa base, le altre le varianti (_p1, _p2…).
    return [{ printId: i === 0 ? cardCode : `${cardCode}_p${String(i)}`, rarity, image: id }]
  })
  if (printings.length === 0) {
    warn(`${cardCode}: nessuna immagine`)
    return null
  }

  const counter = integer(c.counter)
  const power = integer(c.power)
  return {
    cardCode,
    name,
    category,
    cost: category === 'Leader' ? null : (integer(c.cost) ?? 0),
    life: category === 'Leader' ? integer(c.life) : null,
    power: category === 'Leader' || category === 'Character' ? (power ?? 0) : null,
    counter: counter === 0 ? null : counter,
    attributes: strings(c.attribute),
    colors: strings(c.color),
    types: strings(c.type),
    // Il sito delle anteprime non indica il Block: nessun limite finché non arriva quello ufficiale.
    block: null,
    effect: text(c.effect),
    trigger: text(c.trigger),
    keywords: [],
    credit: text(c.translation_credit),
    printings,
  }
}

/**
 * Il JSON di un Set del sito delle anteprime. Solo le carte nuove (`cards`): le varianti nuove
 * di carte già uscite (`sp_cards`) e le carte senza codice (`unknown_id_cards`) si ignorano.
 */
export function parsePreviewSet(
  siteId: string,
  json: unknown,
  warn: (message: string) => void = () => undefined,
): PreviewSet {
  if (typeof json !== 'object' || json === null) throw new Error(`${siteId}: JSON non valido`)
  const { data, cards } = json as { data?: { name?: unknown }; cards?: unknown }
  if (!Array.isArray(cards)) throw new Error(`${siteId}: manca l'elenco delle carte`)

  const byCode = new Map<string, PreviewCard>()
  for (const raw of cards) {
    const card = parseCard(raw, warn)
    if (!card) continue
    if (byCode.has(card.cardCode)) warn(`${card.cardCode}: ripetuta, vale la prima`)
    else byCode.set(card.cardCode, card)
  }
  const parsed = [...byCode.values()].sort((a, b) => a.cardCode.localeCompare(b.cardCode))
  const names = new Set(parsed.map((c) => c.name))
  for (const card of parsed) card.keywords = extractKeywords([card.effect, card.trigger], names)

  return {
    siteId,
    code: previewSetCode(siteId),
    name: text(data?.name) ?? previewSetCode(siteId),
    cards: parsed,
  }
}

export interface PreviewUpsertStats {
  cards: number
  printings: number
  /** Card saltate perché già ufficiali. */
  official: number
  /** Printing in anteprima tolte perché sparite dal sito. */
  removed: number
}

/**
 * Salva un Set in anteprima. Non tocca mai Card o Set ufficiali: le Card già presenti nella
 * Official Card List si saltano. Va chiamata dentro una transazione.
 */
export async function upsertPreviewSet(
  tx: postgres.TransactionSql,
  set: PreviewSet,
): Promise<PreviewUpsertStats> {
  const stats: PreviewUpsertStats = { cards: 0, printings: 0, official: 0, removed: 0 }
  const [existing] = await tx<{ series_id: number; preview: boolean }[]>`
    select series_id, preview from public.sets where code = ${set.code}
  `
  // Il Set è già ufficiale: niente anteprime.
  if (existing && !existing.preview) return stats

  // I Set in anteprima hanno series_id negativi, per non scontrarsi con quelli ufficiali.
  const [next] = await tx<{ id: number }[]>`
    select least(coalesce(min(series_id), 0), 0) - 1 as id from public.sets
  `
  const seriesId = existing?.series_id ?? next?.id ?? -1
  await tx`
    insert into public.sets as s (series_id, code, name, preview)
    values (${seriesId}, ${set.code}, ${set.name}, true)
    on conflict (series_id) do update set name = excluded.name, updated_at = now()
    where s.name is distinct from excluded.name
  `

  const official = new Set(
    (
      await tx<{ card_code: string }[]>`
        select card_code from public.cards
        where not preview and card_code = any(${set.cards.map((c) => c.cardCode)})
      `
    ).map((r) => r.card_code),
  )
  const cards = set.cards.filter((c) => !official.has(c.cardCode))
  stats.official = official.size

  if (cards.length > 0) {
    const cardRows = cards.map((c) => ({
      card_code: c.cardCode,
      name: c.name,
      category: c.category,
      cost: c.cost,
      life: c.life,
      power: c.power,
      counter: c.counter,
      attributes: c.attributes,
      colors: c.colors,
      types: c.types,
      effect: c.effect,
      trigger: c.trigger,
      keywords: c.keywords,
      preview_credit: c.credit,
    }))
    const changed = await tx`
      insert into public.cards as c (
        card_code, name, category, cost, life, power, counter, attributes, colors, types,
        effect, trigger, keywords, preview_credit, preview
      )
      select r.*, true from jsonb_to_recordset(${tx.json(cardRows)}::jsonb) as r(
        card_code text, name text, category text, cost smallint, life smallint, power integer,
        counter integer, attributes text[], colors text[], types text[], effect text,
        trigger text, keywords text[], preview_credit text
      )
      on conflict (card_code) do update set
        name = excluded.name, category = excluded.category, cost = excluded.cost,
        life = excluded.life, power = excluded.power, counter = excluded.counter,
        attributes = excluded.attributes, colors = excluded.colors, types = excluded.types,
        effect = excluded.effect, trigger = excluded.trigger, keywords = excluded.keywords,
        preview_credit = excluded.preview_credit, updated_at = now()
      where c.preview and (c.name, c.category, c.cost, c.life, c.power, c.counter,
        c.attributes, c.colors, c.types, c.effect, c.trigger, c.keywords, c.preview_credit)
        is distinct from (excluded.name, excluded.category, excluded.cost, excluded.life,
        excluded.power, excluded.counter, excluded.attributes, excluded.colors, excluded.types,
        excluded.effect, excluded.trigger, excluded.keywords, excluded.preview_credit)
      returning 1
    `
    stats.cards = changed.length

    const printingRows = cards.flatMap((c) =>
      c.printings.map((p) => ({
        print_id: p.printId,
        card_code: c.cardCode,
        series_id: seriesId,
        rarity: p.rarity,
        preview_image: `${set.siteId}/${p.image}`,
      })),
    )
    // Immagine cambiata sul sito: image_synced_at torna null e il Preview Sync la riscarica.
    const changedPrintings = await tx`
      insert into public.printings as p (
        print_id, card_code, series_id, rarity, preview_image, preview
      )
      select r.*, true from jsonb_to_recordset(${tx.json(printingRows)}::jsonb) as r(
        print_id text, card_code text, series_id integer, rarity text, preview_image text
      )
      on conflict (print_id) do update set
        series_id = excluded.series_id, rarity = excluded.rarity,
        preview_image = excluded.preview_image,
        image_synced_at = case when p.preview_image is distinct from excluded.preview_image
          then null else p.image_synced_at end,
        updated_at = now()
      where p.preview and (p.series_id, p.rarity, p.preview_image)
        is distinct from (excluded.series_id, excluded.rarity, excluded.preview_image)
      returning 1
    `
    stats.printings = changedPrintings.length

    // Varianti tolte dal sito: via anche da qui (i mazzi che le mostravano tornano alla base).
    const keep = printingRows.map((r) => r.print_id)
    const codes = cards.map((c) => c.cardCode)
    await tx`
      update public.deck_cards set print_id = null
      where print_id in (select print_id from public.printings
        where preview and card_code = any(${codes}) and not (print_id = any(${keep})))
    `
    await tx`
      update public.decks set leader_print_id = null
      where leader_print_id in (select print_id from public.printings
        where preview and card_code = any(${codes}) and not (print_id = any(${keep})))
    `
    const removed = await tx`
      delete from public.printings
      where preview and card_code = any(${codes}) and not (print_id = any(${keep}))
      returning 1
    `
    stats.removed = removed.length
  }
  return stats
}

/** Le Printing in anteprima senza immagine sul nostro Storage. */
export async function pendingPreviewImages(
  sql: postgres.Sql,
): Promise<{ printId: string; image: string }[]> {
  const rows = await sql<{ print_id: string; preview_image: string }[]>`
    select print_id, preview_image from public.printings
    where preview and image_synced_at is null and preview_image is not null
    order by print_id
  `
  return rows.map((r) => ({ printId: r.print_id, image: r.preview_image }))
}

/** Percorso su Storage dell'immagine di un'anteprima: separato da quelle ufficiali. */
export function previewImagePath(variant: 'thumb' | 'full', printId: string): string {
  return `preview/${variant}/${printId}.webp`
}

export interface PreviewSyncOptions {
  sql: postgres.Sql
  /** Il JSON di un Set, o null se il sito non ce l'ha (403/404). */
  fetchSet: (siteId: string) => Promise<unknown>
  /** Un'immagine del sito, dal percorso "eb05/eb05-010". */
  fetchImage: (path: string) => Promise<Uint8Array>
  /** Converte e carica le due versioni dell'immagine. */
  storeImage: (printId: string, image: Uint8Array) => Promise<void>
  delayMs: number
  sleep?: (ms: number) => Promise<void>
  log?: (message: string) => void
}

export interface PreviewSyncStats {
  sets: string[]
  cards: number
  printings: number
  removed: number
  images: number
  failedImages: string[]
  /** Set che non si sono scaricati nemmeno al secondo tentativo. */
  failedSets: string[]
}

/** Attesa prima del secondo tentativo di una richiesta. */
const RETRY_DELAY_MS = 5000

async function withRetry<T>(fn: () => Promise<T>, sleep: (ms: number) => Promise<void>) {
  try {
    return await fn()
  } catch {
    await sleep(RETRY_DELAY_MS)
    return fn()
  }
}

/** Esegue il Preview Sync: cerca i Set nuovi, salva le carte, scarica le immagini mancanti. */
export async function runPreviewSync(options: PreviewSyncOptions): Promise<PreviewSyncStats> {
  const { sql, delayMs } = options
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const log = options.log ?? (() => undefined)
  const stats: PreviewSyncStats = {
    sets: [],
    cards: 0,
    printings: 0,
    removed: 0,
    images: 0,
    failedImages: [],
    failedSets: [],
  }

  const official = await sql<{ code: string }[]>`select code from public.sets where not preview`
  const candidates = candidateSets(official.map((s) => s.code))
  for (const [i, siteId] of candidates.entries()) {
    if (i > 0) await sleep(delayMs)
    // Un Set che non risponde si salta: gli altri vanno avanti, ci si riprova la notte dopo.
    let json: unknown
    try {
      json = await withRetry(() => options.fetchSet(siteId), sleep)
    } catch (error) {
      stats.failedSets.push(siteId)
      log(`${siteId}: non scaricato (${error instanceof Error ? error.message : String(error)})`)
      continue
    }
    if (json === null) continue
    const set = parsePreviewSet(siteId, json, (message) => {
      log(`${siteId}: ${message}`)
    })
    const saved = await sql.begin((tx) => upsertPreviewSet(tx, set))
    stats.sets.push(set.code)
    stats.cards += saved.cards
    stats.printings += saved.printings
    stats.removed += saved.removed
    log(
      `${set.code} ${set.name}: ${String(set.cards.length)} carte (${String(saved.official)} già ufficiali), ` +
        `cambiate ${String(saved.cards)} carte e ${String(saved.printings)} stampe`,
    )
  }

  const pending = await pendingPreviewImages(sql)
  for (const [i, { printId, image }] of pending.entries()) {
    if (i > 0) await sleep(delayMs)
    try {
      await options.storeImage(printId, await withRetry(() => options.fetchImage(image), sleep))
      await sql`
        update public.printings set image_synced_at = now(), updated_at = now()
        where print_id = ${printId}
      `
      stats.images++
    } catch (error) {
      stats.failedImages.push(printId)
      log(
        `${printId}: immagine non scaricata (${error instanceof Error ? error.message : String(error)})`,
      )
    }
  }
  return stats
}
