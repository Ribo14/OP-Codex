import { readFileSync } from 'node:fs'
import type postgres from 'postgres'
import { afterAll, describe, expect, it } from 'vitest'
import { parseCardListPage } from '../../catalog-sync/card-list-parser.ts'
import {
  connect,
  imageSyncRepository,
  upsertCatalogPage,
} from '../../catalog-sync/catalog-store.ts'
import { actAs, errorCodeOf, inRollback } from './helpers.ts'

const sql = connect()

afterAll(async () => {
  await sql.end()
})

const st01 = parseCardListPage(
  readFileSync(new URL('../../catalog-sync/fixtures/st-01.html', import.meta.url), 'utf8'),
)

describe('Stato dell’Image Sync su printings', () => {
  it('elenca le Printing senza immagine e le toglie una volta segnate', async () => {
    await inRollback(sql, async (tx) => {
      // Indipendente da cosa c'è già nel DB: solo le 17 Printing di ST-01 restano da scaricare.
      await upsertCatalogPage(tx, st01)
      await tx`update public.printings set image_synced_at = now()`
      await tx`update public.printings set image_synced_at = null where series_id = 569001`
      const repository = imageSyncRepository(tx)

      expect(await repository.countPending()).toBe(17)
      expect(await repository.pendingPrintIds(3)).toEqual(['ST01-001', 'ST01-002', 'ST01-003'])

      await repository.markSynced('ST01-001')
      expect(await repository.countPending()).toBe(16)
      expect(await repository.pendingPrintIds(2)).toEqual(['ST01-002', 'ST01-003'])
    })
  })

  it('un nuovo sync del Set non azzera le immagini già scaricate', async () => {
    await inRollback(sql, async (tx) => {
      await upsertCatalogPage(tx, st01)
      await imageSyncRepository(tx).markSynced('ST01-001')
      await upsertCatalogPage(tx, st01)

      const [row] = await tx<{ synced: boolean }[]>`
        select image_synced_at is not null as synced from public.printings where print_id = 'ST01-001'
      `
      expect(row?.synced).toBe(true)
    })
  })
})

describe('Bucket card-images', () => {
  it('è pubblico in lettura, accetta solo WebP fino a 1 MB', async () => {
    const [bucket] = await sql`
      select public, file_size_limit, allowed_mime_types from storage.buckets where id = 'card-images'
    `
    expect(bucket).toEqual({
      public: true,
      file_size_limit: '1048576',
      allowed_mime_types: ['image/webp'],
    })
  })

  for (const role of ['anon', 'authenticated'] as const) {
    it(`il ruolo ${role} non può elencare, caricare, modificare o cancellare file`, async () => {
      await inRollback(sql, async (tx) => {
        await tx`
          insert into storage.objects (bucket_id, name) values ('card-images', 'thumb/TEST-000.webp')
        `
        await actAs(tx, role)

        const listed = await tx`select name from storage.objects where bucket_id = 'card-images'`
        expect(listed).toEqual([])

        // Rifiutata = errore di Postgres oppure nessuna riga toccata (la RLS la nasconde).
        const denied = async (
          statement: (sp: postgres.TransactionSql) => PromiseLike<readonly unknown[]>,
        ) => {
          const code = await errorCodeOf(tx, async (sp) => {
            const rows = await statement(sp)
            if (rows.length === 0) throw Object.assign(new Error('nessuna riga'), { code: 'RLS' })
          })
          return code !== null
        }

        expect(
          await denied(
            (sp) => sp`
              insert into storage.objects (bucket_id, name)
              values ('card-images', 'full/X-001.webp') returning id
            `,
          ),
        ).toBe(true)
        expect(
          await denied(
            (sp) => sp`
              update storage.objects set name = 'thumb/X.webp'
              where bucket_id = 'card-images' returning id
            `,
          ),
        ).toBe(true)
        expect(
          await denied(
            (sp) => sp`delete from storage.objects where bucket_id = 'card-images' returning id`,
          ),
        ).toBe(true)
      })
    })
  }
})
