import postgres from 'postgres'
import type { ParsedCardListPage } from './card-list-parser.ts'
import { mergeCatalogPages, type MergedCatalog } from './catalog-merge.ts'
import type { ImageSyncRepository } from './image-sync.ts'

// Default del Supabase locale (`npx supabase start`): non è un segreto, vale solo in locale.
export const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** URL del database: SUPABASE_DB_URL se impostata e non vuota, altrimenti il Supabase locale. */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.SUPABASE_DB_URL?.trim() ?? ''
  return url === '' ? LOCAL_DB_URL : url
}

export function connect(url = databaseUrl()): postgres.Sql {
  const host = new URL(url).hostname
  const isLocal = host === '127.0.0.1' || host === 'localhost'
  return postgres(url, {
    connect_timeout: 10,
    max: 1,
    onnotice: () => undefined,
    // In produzione (pooler di Supabase) la connessione deve essere cifrata.
    ssl: isLocal ? false : 'require',
  })
}

type Sql = postgres.Sql | postgres.TransactionSql

/** Stato dell'Image Sync salvato sulla tabella printings. */
export function imageSyncRepository(sql: Sql): ImageSyncRepository {
  return {
    async pendingPrintIds(limit) {
      const rows = await sql<{ print_id: string }[]>`
        select print_id from public.printings
        where image_synced_at is null
        order by print_id
        limit ${limit}
      `
      return rows.map((row) => row.print_id)
    },
    async countPending() {
      const [row] = await sql<{ n: number }[]>`
        select count(*)::int as n from public.printings where image_synced_at is null
      `
      return row?.n ?? 0
    },
    async markSynced(printId) {
      // Anche updated_at: così l'aggiornamento incrementale dell'app vede la nuova immagine.
      await sql`
        update public.printings set image_synced_at = now(), updated_at = now()
        where print_id = ${printId}
      `
    },
  }
}

export interface UpsertCounts {
  inserted: number
  updated: number
}

export interface CatalogUpsertStats {
  sets: UpsertCounts
  cards: UpsertCounts
  printings: UpsertCounts
}

// Righe per singola query: abbastanza poche da restare leggere, abbastanza da fare poche richieste.
const BATCH_SIZE = 500

function chunks<T>(items: readonly T[]): T[][] {
  const result: T[][] = []
  for (let i = 0; i < items.length; i += BATCH_SIZE) result.push(items.slice(i, i + BATCH_SIZE))
  return result
}

function count(rows: readonly { inserted: boolean }[], into: UpsertCounts): void {
  for (const row of rows) {
    if (row.inserted) into.inserted++
    else into.updated++
  }
}

/**
 * Salva il catalogo con upsert idempotenti. Una riga esistente viene aggiornata solo se
 * qualche campo è davvero cambiato: rilanciare il sync senza novità non modifica nulla.
 * Non cancella mai niente. Va chiamata dentro una transazione.
 */
export async function upsertCatalog(
  tx: postgres.TransactionSql,
  catalog: MergedCatalog,
): Promise<CatalogUpsertStats> {
  const stats: CatalogUpsertStats = {
    sets: { inserted: 0, updated: 0 },
    cards: { inserted: 0, updated: 0 },
    printings: { inserted: 0, updated: 0 },
  }

  for (const batch of chunks(catalog.sets)) {
    const rows = batch.map((s) => ({
      series_id: s.seriesId,
      code: s.code,
      name: s.name,
      product_type: s.productType,
    }))
    const result = await tx<{ inserted: boolean }[]>`
      insert into public.sets as s (series_id, code, name, product_type)
      select * from jsonb_to_recordset(${tx.json(rows)}::jsonb)
        as r(series_id integer, code text, name text, product_type text)
      on conflict (series_id) do update set
        code = excluded.code,
        name = excluded.name,
        product_type = excluded.product_type,
        updated_at = now()
      where (s.code, s.name, s.product_type)
        is distinct from (excluded.code, excluded.name, excluded.product_type)
      returning (xmax = 0) as inserted
    `
    count(result, stats.sets)
  }

  for (const batch of chunks(catalog.cards)) {
    const rows = batch.map((c) => ({
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
      block: c.block,
      effect: c.effect,
      trigger: c.trigger,
      keywords: c.keywords,
    }))
    const result = await tx<{ inserted: boolean }[]>`
      insert into public.cards as c (
        card_code, name, category, cost, life, power, counter,
        attributes, colors, types, block, effect, trigger, keywords
      )
      select * from jsonb_to_recordset(${tx.json(rows)}::jsonb) as r(
        card_code text, name text, category text, cost smallint, life smallint,
        power integer, counter integer, attributes text[], colors text[], types text[],
        block text, effect text, trigger text, keywords text[]
      )
      on conflict (card_code) do update set
        name = excluded.name,
        category = excluded.category,
        cost = excluded.cost,
        life = excluded.life,
        power = excluded.power,
        counter = excluded.counter,
        attributes = excluded.attributes,
        colors = excluded.colors,
        types = excluded.types,
        block = excluded.block,
        effect = excluded.effect,
        trigger = excluded.trigger,
        keywords = excluded.keywords,
        updated_at = now()
      where (c.name, c.category, c.cost, c.life, c.power, c.counter,
             c.attributes, c.colors, c.types, c.block, c.effect, c.trigger, c.keywords)
        is distinct from
            (excluded.name, excluded.category, excluded.cost, excluded.life, excluded.power,
             excluded.counter, excluded.attributes, excluded.colors, excluded.types,
             excluded.block, excluded.effect, excluded.trigger, excluded.keywords)
      returning (xmax = 0) as inserted
    `
    count(result, stats.cards)
  }

  for (const batch of chunks(catalog.printings)) {
    const rows = batch.map((p) => ({
      print_id: p.printId,
      card_code: p.cardCode,
      series_id: p.seriesId,
      rarity: p.rarity,
    }))
    const result = await tx<{ inserted: boolean }[]>`
      insert into public.printings as p (print_id, card_code, series_id, rarity)
      select * from jsonb_to_recordset(${tx.json(rows)}::jsonb)
        as r(print_id text, card_code text, series_id integer, rarity text)
      on conflict (print_id) do update set
        card_code = excluded.card_code,
        series_id = excluded.series_id,
        rarity = excluded.rarity,
        updated_at = now()
      where (p.card_code, p.series_id, p.rarity)
        is distinct from (excluded.card_code, excluded.series_id, excluded.rarity)
      returning (xmax = 0) as inserted
    `
    count(result, stats.printings)
  }

  return stats
}

/** Scorciatoia per salvare una sola pagina di Set (sync di un Set, test). */
export function upsertCatalogPage(
  tx: postgres.TransactionSql,
  page: ParsedCardListPage,
): Promise<CatalogUpsertStats> {
  return upsertCatalog(tx, mergeCatalogPages([page]))
}

export type JobName = 'catalog_sync' | 'image_sync'

/** Registra l'inizio di un job in job_runs e restituisce l'id dell'esecuzione. */
export async function startJobRun(sql: Sql, job: JobName): Promise<number> {
  const [row] = await sql<{ id: string }[]>`
    insert into public.job_runs (job) values (${job}) returning id
  `
  if (!row) throw new Error('Impossibile registrare il job')
  return Number(row.id)
}

export async function finishJobRun(
  sql: Sql,
  id: number,
  outcome: { status: 'success' | 'error'; stats: object; error?: string },
): Promise<void> {
  await sql`
    update public.job_runs set
      status = ${outcome.status},
      finished_at = now(),
      stats = ${sql.json(JSON.parse(JSON.stringify(outcome.stats)) as postgres.JSONValue)},
      error = ${outcome.error ?? null}
    where id = ${id}
  `
}
