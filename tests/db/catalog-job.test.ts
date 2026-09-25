import { readFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { parseCardListPage } from '../../catalog-sync/card-list-parser.ts'
import { INDEX_SERIES_ID, runCatalogSync } from '../../catalog-sync/catalog-job.ts'
import { connect } from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

const sql = connect()
const createdRuns: number[] = []

afterAll(async () => {
  if (createdRuns.length > 0) await sql`delete from public.job_runs where id in ${sql(createdRuns)}`
  await sql.end()
})

const fixture = (name: string) =>
  readFileSync(new URL(`../../catalog-sync/fixtures/${name}.html`, import.meta.url), 'utf8')

// Menu ridotto ai tre Set di cui abbiamo le fixture.
const MENU = `<select name="series" class="selectModal" id="series">
  <option value="569301">PREMIUM BOOSTER &lt;br class=&quot;spInline&quot;&gt;-ONE PIECE CARD THE BEST- [PRB-01]</option>
  <option value="569101" selected>BOOSTER PACK &lt;br class=&quot;spInline&quot;&gt;-ROMANCE DAWN- [OP-01]</option>
  <option value="569001">STARTER DECK &lt;br class=&quot;spInline&quot;&gt;-Straw Hat Crew- [ST-01]</option>
</select>`

function withMenu(html: string): string {
  return html.replace(/<select name="series"[\s\S]*?<\/select>/, MENU)
}

const PAGES: Record<number, string> = {
  [INDEX_SERIES_ID]: withMenu(fixture('op-01')),
  569001: fixture('st-01'),
  569301: fixture('prb-01'),
}

function fakeSite(pages: Record<number, string>) {
  const requested: number[] = []
  return {
    requested,
    fetchSetPage: (seriesId: number) => {
      requested.push(seriesId)
      const html = pages[seriesId]
      return html
        ? Promise.resolve(html)
        : Promise.reject(new Error(`HTTP 404 (${String(seriesId)})`))
    },
  }
}

async function run(pages: Record<number, string>) {
  const site = fakeSite(pages)
  const sleeps: number[] = []
  const before = await latestRunId()
  try {
    const stats = await runCatalogSync({
      sql,
      fetchSetPage: site.fetchSetPage,
      delayMs: 3000,
      sleep: (ms) => {
        sleeps.push(ms)
        return Promise.resolve()
      },
    })
    return { stats, site, sleeps }
  } finally {
    const after = await sql<{ id: string }[]>`select id from public.job_runs where id > ${before}`
    createdRuns.push(...after.map((row) => Number(row.id)))
  }
}

async function latestRunId(): Promise<number> {
  const [row] = await sql<{ id: string | null }[]>`select max(id) as id from public.job_runs`
  return Number(row?.id ?? 0)
}

async function catalogCounts() {
  const [row] = await sql<{ sets: number; cards: number; printings: number }[]>`
    select
      (select count(*)::int from public.sets) as sets,
      (select count(*)::int from public.cards) as cards,
      (select count(*)::int from public.printings) as printings
  `
  return row
}

describe('Catalog Sync completo', () => {
  it('scopre i Set dal menu, li scarica uno alla volta con una pausa e li salva', async () => {
    const { stats, site, sleeps } = await run(PAGES)

    // Il menu si legge dalla pagina di OP-01: non la riscarica.
    expect(site.requested).toEqual([INDEX_SERIES_ID, 569301, 569001])
    expect(sleeps).toEqual([3000, 3000])
    expect(stats.pages).toBe(3)
    // Card distinte = unione dei Card Code delle tre pagine (le ristampe non si contano due volte).
    const distinctCards = new Set(
      ['op-01', 'st-01', 'prb-01'].flatMap((name) =>
        parseCardListPage(fixture(name)).cards.map((c) => c.cardCode),
      ),
    ).size
    expect(stats.catalog).toEqual({ sets: 3, cards: distinctCards, printings: 154 + 17 + 319 })

    const [job] = await sql`
      select job, status, finished_at is not null as finished, stats->'catalog' as catalog
      from public.job_runs order by id desc limit 1
    `
    expect(job).toMatchObject({ job: 'catalog_sync', status: 'success', finished: true })
    expect(job?.catalog).toEqual(stats.catalog)
  })

  it('una seconda esecuzione senza novità non modifica nulla e lo registra', async () => {
    await run(PAGES)
    const { stats } = await run(PAGES)

    const nothing = { inserted: 0, updated: 0 }
    expect(stats.sets).toEqual(nothing)
    expect(stats.cards).toEqual(nothing)
    expect(stats.printings).toEqual(nothing)

    const [job] = await sql`
      select status, stats->'cards' as cards from public.job_runs order by id desc limit 1
    `
    expect(job).toEqual({ status: 'success', cards: nothing })
  })

  it('con un HTML ufficiale cambiato fallisce, lo registra e non tocca il catalogo', async () => {
    await run(PAGES)
    const before = await catalogCounts()
    const [otamaBefore] = await sql`select * from public.cards where card_code = 'OP01-006'`

    // Il sito ha cambiato la struttura dell'intestazione delle carte di ST-01.
    const broken = {
      ...PAGES,
      569001: PAGES[569001]?.replaceAll('class="infoCol"', 'class="info"') ?? '',
    }
    await expect(run(broken)).rejects.toThrow('Intestazione della carta non valida')

    expect(await catalogCounts()).toEqual(before)
    const [otamaAfter] = await sql`select * from public.cards where card_code = 'OP01-006'`
    expect(otamaAfter).toEqual(otamaBefore)

    const [job] = await sql`
      select status, error, finished_at is not null as finished
      from public.job_runs order by id desc limit 1
    `
    expect(job).toMatchObject({ status: 'error', finished: true })
    expect(String(job?.error)).toContain('ST01-001: Intestazione della carta non valida')
  })

  it('se una pagina non si scarica fallisce senza scrivere', async () => {
    const before = await catalogCounts()
    const missing = { ...PAGES }
    delete missing[569301]

    await expect(run(missing)).rejects.toThrow('HTTP 404')
    expect(await catalogCounts()).toEqual(before)
  })
})

describe('job_runs', () => {
  for (const role of ['anon', 'authenticated'] as const) {
    it(`il ruolo ${role} non può leggere né scrivere`, async () => {
      await inRollback(sql, async (tx) => {
        await actAs(tx, role)
        // authenticated ha il permesso di lettura, ma la policy apre le righe solo all'Admin
        // attivo (RIB-19, tests/db/admin.test.ts).
        if (role === 'anon') {
          expect(await errorCodeOf(tx, (sp) => sp`select * from public.job_runs`)).toBe('42501')
        } else {
          expect(await tx`select * from public.job_runs`).toEqual([])
        }
        expect(
          await errorCodeOf(
            tx,
            (sp) => sp`insert into public.job_runs (job) values ('catalog_sync')`,
          ),
        ).toBe('42501')
      })
    })
  }
})
