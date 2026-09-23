import postgres from 'postgres'
import type { ParsedCardListPage } from './card-list-parser.ts'
import type { ImageSyncRepository } from './image-sync.ts'

// Default del Supabase locale (`npx supabase start`): non è un segreto, vale solo in locale.
export const LOCAL_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

/** URL del database: SUPABASE_DB_URL se impostata e non vuota, altrimenti il Supabase locale. */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const url = env.SUPABASE_DB_URL?.trim() ?? ''
  return url === '' ? LOCAL_DB_URL : url
}

export function connect(url = databaseUrl()): postgres.Sql {
  return postgres(url, { connect_timeout: 10, max: 1, onnotice: () => undefined })
}

/** Stato dell'Image Sync salvato sulla tabella printings. */
export function imageSyncRepository(
  sql: postgres.Sql | postgres.TransactionSql,
): ImageSyncRepository {
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
      await sql`update public.printings set image_synced_at = now() where print_id = ${printId}`
    },
  }
}

export interface UpsertSummary {
  set: string
  cards: number
  printings: number
}

/**
 * Salva nel catalogo il contenuto di una pagina di Set con upsert idempotenti:
 * ripetere il sync aggiorna le righe esistenti senza crearne di nuove.
 * Va chiamata dentro una transazione, così un errore non lascia il catalogo a metà.
 */
export async function upsertCatalogPage(
  tx: postgres.TransactionSql,
  page: ParsedCardListPage,
): Promise<UpsertSummary> {
  const { set, cards, printings } = page

  await tx`
    insert into public.sets (series_id, code, name, product_type)
    values (${set.seriesId}, ${set.code}, ${set.name}, ${set.productType})
    on conflict (series_id) do update set
      code = excluded.code,
      name = excluded.name,
      product_type = excluded.product_type,
      updated_at = now()
  `

  for (const card of cards) {
    await tx`
      insert into public.cards (
        card_code, name, category, cost, life, power, counter,
        attributes, colors, types, block, effect, trigger
      ) values (
        ${card.cardCode}, ${card.name}, ${card.category}, ${card.cost}, ${card.life},
        ${card.power}, ${card.counter}, ${card.attributes}, ${card.colors}, ${card.types},
        ${card.block}, ${card.effect}, ${card.trigger}
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
        updated_at = now()
    `
  }

  for (const printing of printings) {
    await tx`
      insert into public.printings (print_id, card_code, series_id, rarity)
      values (${printing.printId}, ${printing.cardCode}, ${set.seriesId}, ${printing.rarity})
      on conflict (print_id) do update set
        card_code = excluded.card_code,
        series_id = excluded.series_id,
        rarity = excluded.rarity,
        updated_at = now()
    `
  }

  return { set: set.code, cards: cards.length, printings: printings.length }
}
