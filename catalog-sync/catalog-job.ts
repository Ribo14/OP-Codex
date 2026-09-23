import type postgres from 'postgres'
import {
  parseCardListPage,
  parseSeriesList,
  type ParsedCardListPage,
  type ParsedSet,
} from './card-list-parser.ts'
import { mergeCatalogPages } from './catalog-merge.ts'
import {
  finishJobRun,
  startJobRun,
  upsertCatalog,
  type CatalogUpsertStats,
} from './catalog-store.ts'

// Catalog Sync completo (ADR-0004): scopre tutti i Set dal menu della Official Card List,
// scarica le loro pagine una alla volta e salva il catalogo in un'unica transazione.

/** Pagina usata per leggere il menu dei Set: qualsiasi Set va bene, OP-01 esiste sempre. */
export const INDEX_SERIES_ID = 569101

export interface CatalogSyncOptions {
  sql: postgres.Sql
  fetchSetPage: (seriesId: number) => Promise<string>
  /** Pausa tra una richiesta al sito ufficiale e la successiva. */
  delayMs: number
  sleep?: (ms: number) => Promise<void>
  log?: (message: string) => void
}

export interface CatalogSyncStats extends CatalogUpsertStats {
  pages: number
  catalog: { sets: number; cards: number; printings: number }
  duplicatePrintIds: string[]
}

/**
 * Esegue il Catalog Sync e lo registra in job_runs.
 * Se una pagina non si scarica o non si legge (es. HTML ufficiale cambiato) il job fallisce
 * PRIMA di scrivere: il catalogo resta com'era. Non cancella mai dati.
 */
export async function runCatalogSync(options: CatalogSyncOptions): Promise<CatalogSyncStats> {
  const { sql, fetchSetPage, delayMs } = options
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const log = options.log ?? (() => undefined)

  const runId = await startJobRun(sql, 'catalog_sync')
  try {
    const indexHtml = await fetchSetPage(INDEX_SERIES_ID)
    const series = parseSeriesList(indexHtml)
    log(`Set trovati nel menu: ${String(series.length)}`)

    const pages: ParsedCardListPage[] = []
    for (const [index, set] of series.entries()) {
      let html = indexHtml
      if (set.seriesId !== INDEX_SERIES_ID) {
        // C'è sempre stata almeno una richiesta prima (quella del menu): pausa, poi la pagina.
        await sleep(delayMs)
        html = await fetchSetPage(set.seriesId)
      }
      pages.push(parsePage(html, set))
      log(`${String(index + 1)}/${String(series.length)} ${set.code}`)
    }

    const catalog = mergeCatalogPages(pages)
    const upsert = await sql.begin((tx) => upsertCatalog(tx, catalog))

    const stats: CatalogSyncStats = {
      ...upsert,
      pages: pages.length,
      catalog: {
        sets: catalog.sets.length,
        cards: catalog.cards.length,
        printings: catalog.printings.length,
      },
      duplicatePrintIds: catalog.duplicatePrintIds,
    }
    await finishJobRun(sql, runId, { status: 'success', stats })
    return stats
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await finishJobRun(sql, runId, { status: 'error', stats: {}, error: message })
    throw error
  }
}

/** Legge una pagina e controlla che sia davvero quella del Set richiesto. */
function parsePage(html: string, expected: ParsedSet): ParsedCardListPage {
  const page = parseCardListPage(html)
  if (page.set.seriesId !== expected.seriesId) {
    throw new Error(
      `${expected.code}: la pagina scaricata è del Set ${page.set.code} (${String(page.set.seriesId)})`,
    )
  }
  return page
}
