import { describe, expect, it, vi } from 'vitest'
import {
  buildCatalog,
  mergeSnapshot,
  OVERLAP_MS,
  sinceFor,
  syncSnapshot,
  upgradeSnapshot,
  type CatalogRows,
  type CatalogSnapshot,
  type RawCard,
  type RawPrinting,
} from './catalog-sync'

const T1 = '2026-09-20T03:20:00.000Z'
const T2 = '2026-09-22T03:20:00.000Z'

const rawCard = (card_code: string, name: string, updated_at = T1): RawCard => ({
  card_code,
  name,
  category: 'Character',
  cost: 1,
  life: null,
  power: 1000,
  counter: null,
  colors: ['Red'],
  attributes: [],
  types: [],
  block: '1',
  effect: null,
  trigger: null,
  keywords: [],
  updated_at,
})

const rawPrinting = (print_id: string, card_code: string, updated_at = T1): RawPrinting => ({
  print_id,
  card_code,
  rarity: 'C',
  series_id: 1,
  image_synced_at: null,
  updated_at,
})

const FULL: CatalogRows = {
  sets: [{ series_id: 1, code: 'OP-01', name: 'ROMANCE DAWN', updated_at: T1 }],
  cards: [rawCard('OP01-002', 'Trafalgar Law'), rawCard('OP01-001', 'Roronoa Zoro')],
  printings: [
    rawPrinting('OP01-001_p1', 'OP01-001'),
    rawPrinting('OP01-001', 'OP01-001'),
    rawPrinting('OP01-002', 'OP01-002'),
  ],
  faqs: [
    {
      card_code: 'OP01-001',
      items: [
        { question: 'Can I?', answer: 'Yes, you can.', source: 'qa_op01.pdf' },
        { question: 'Broken' },
      ],
      updated_at: T1,
    },
  ],
}

const NOTHING: CatalogRows = { sets: [], cards: [], printings: [], faqs: [] }

describe('buildCatalog', () => {
  it('ordina le carte e mette la Printing base per prima, col codice del Set', () => {
    const catalog = buildCatalog(FULL)
    expect(catalog.cards.map((c) => c.cardCode)).toEqual(['OP01-001', 'OP01-002'])
    expect(catalog.cards[0]?.printings.map((p) => p.printId)).toEqual(['OP01-001', 'OP01-001_p1'])
    expect(catalog.cards[0]?.printings[0]).toEqual({
      printId: 'OP01-001',
      rarity: 'C',
      setCode: 'OP-01',
      hasImage: false,
    })
    expect(catalog.sets).toEqual([{ seriesId: 1, code: 'OP-01', name: 'ROMANCE DAWN' }])
  })

  it('FAQ ufficiali sulla carta, solo quelle ben formate (RIB-44)', () => {
    const catalog = buildCatalog(FULL)
    expect(catalog.cards[0]?.faqs).toEqual([
      { question: 'Can I?', answer: 'Yes, you can.', source: 'qa_op01.pdf' },
    ])
    expect(catalog.cards[1]?.faqs).toEqual([])
  })
})

describe('copia salvata da una versione senza FAQ', () => {
  it('si usa subito, ma senza watermark: il prossimo aggiornamento riscarica tutto', () => {
    const old: Partial<CatalogSnapshot> = mergeSnapshot(null, FULL, 1000)
    delete old.faqs
    const upgraded = upgradeSnapshot(old as CatalogSnapshot)
    expect(upgraded).toMatchObject({ faqs: [], watermark: null, checkedAt: 1000 })
    expect(upgraded.cards).toHaveLength(2)
    expect(sinceFor(upgraded.watermark)).toBeNull()
  })

  it('una copia già con le FAQ resta com’è', () => {
    const current = mergeSnapshot(null, FULL, 1000)
    expect(upgradeSnapshot(current)).toBe(current)
  })
})

describe('sincronizzazione incrementale', () => {
  it('al primo avvio scarica tutto e ricorda il più recente updated_at', async () => {
    const fetchRows = vi.fn().mockResolvedValue(FULL)
    const { snapshot, changed } = await syncSnapshot(null, fetchRows, 1000)
    expect(fetchRows).toHaveBeenCalledWith(null)
    expect(changed).toBe(true)
    expect(snapshot.watermark).toBe(T1)
    expect(snapshot.checkedAt).toBe(1000)
    expect(snapshot.cards).toHaveLength(2)
  })

  it('dopo chiede solo le righe cambiate, con un piccolo margine prima del watermark', async () => {
    const local = mergeSnapshot(null, FULL, 1000)
    const fetchRows = vi.fn().mockResolvedValue(NOTHING)
    const { snapshot, changed } = await syncSnapshot(local, fetchRows, 2000)
    expect(fetchRows).toHaveBeenCalledWith(new Date(Date.parse(T1) - OVERLAP_MS).toISOString())
    expect(changed).toBe(false)
    expect(snapshot.watermark).toBe(T1)
    expect(snapshot.checkedAt).toBe(2000)
  })

  it('unisce le righe cambiate: aggiorna quelle esistenti e aggiunge le nuove', async () => {
    const local = mergeSnapshot(null, FULL, 1000)
    const delta: CatalogRows = {
      sets: [],
      cards: [rawCard('OP01-002', 'Trafalgar Law (errata)', T2), rawCard('OP01-003', 'Nuova', T2)],
      printings: [{ ...rawPrinting('OP01-003', 'OP01-003', T2), image_synced_at: T2 }],
      faqs: [{ card_code: 'OP01-001', items: [], updated_at: T2 }],
    }
    const { snapshot, changed } = await syncSnapshot(local, () => Promise.resolve(delta), 2000)
    expect(changed).toBe(true)
    expect(snapshot.watermark).toBe(T2)

    const catalog = buildCatalog(snapshot)
    expect(catalog.cards.map((c) => c.name)).toEqual([
      'Roronoa Zoro',
      'Trafalgar Law (errata)',
      'Nuova',
    ])
    expect(catalog.cards[2]?.printings[0]?.hasImage).toBe(true)
    // Le FAQ tolte dai PDF arrivano come elenco vuoto.
    expect(catalog.cards[0]?.faqs).toEqual([])
  })

  it('un errore di rete non tocca la copia locale', async () => {
    const local = mergeSnapshot(null, FULL, 1000)
    await expect(
      syncSnapshot(local, () => Promise.reject(new Error('offline')), 2000),
    ).rejects.toThrow('offline')
    expect(local.checkedAt).toBe(1000)
    expect(local.cards).toHaveLength(2)
  })

  it('sinceFor: null senza watermark', () => {
    expect(sinceFor(null)).toBeNull()
  })
})
