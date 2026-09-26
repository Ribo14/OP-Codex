import { describe, expect, it } from 'vitest'
import type { Catalog, CatalogCard } from '@/catalog/catalog-data'
import {
  collectionCsv,
  csvCell,
  exportFileName,
  exportFiles,
  safeFileName,
  type ExportData,
} from './data-export'

const card = (cardCode: string, name: string, category: string, cost: number | null) =>
  ({
    cardCode,
    name,
    category,
    cost,
    life: null,
    power: null,
    counter: null,
    colors: ['Red'],
    attributes: [],
    types: [],
    block: null,
    effect: null,
    trigger: null,
    keywords: [],
    printings: [
      { printId: cardCode, rarity: 'C', setCode: 'OP-01', hasImage: true },
      { printId: `${cardCode}_p1`, rarity: 'SR', setCode: 'OP-01', hasImage: true },
    ],
  }) satisfies CatalogCard

const CATALOG: Catalog = {
  cards: [
    card('OP01-001', 'Roronoa Zoro', 'Leader', null),
    card('OP01-016', 'Nami; "la navigatrice"', 'Character', 1),
    card('OP01-025', 'Roronoa Zoro', 'Character', 3),
  ],
  sets: [{ seriesId: 1, code: 'OP-01', name: 'ROMANCE DAWN' }],
}

const DATA: ExportData = {
  exportedAt: '2026-09-25T10:00:00.000Z',
  profile: {
    username: 'Ribo',
    email: 'ribo@example.com',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-02T00:00:00Z',
  },
  collection: [
    { printId: 'OP01-025', language: 'EN', quantity: 1, createdAt: 'a', updatedAt: 'b' },
    { printId: 'OP01-016_p1', language: 'JP', quantity: 2, createdAt: 'a', updatedAt: 'b' },
    { printId: 'OP01-016', language: 'EN', quantity: 4, createdAt: 'a', updatedAt: 'b' },
    { printId: 'ZZ99-001', language: 'FR', quantity: 1, createdAt: 'a', updatedAt: 'b' },
  ],
  decks: [
    {
      id: 'd1',
      name: 'Zoro: rosso/verde',
      leaderCode: 'OP01-001',
      leaderPrintId: null,
      format: 'standard',
      visibility: 'private',
      shareLink: null,
      createdAt: 'a',
      updatedAt: 'b',
      cards: [
        { cardCode: 'OP01-025', quantity: 4, printId: null },
        { cardCode: 'OP01-016', quantity: 4, printId: 'OP01-016_p1' },
      ],
    },
    {
      id: 'd2',
      name: 'zoro: ROSSO/verde',
      leaderCode: 'OP01-001',
      leaderPrintId: null,
      format: 'extra',
      visibility: 'link',
      shareLink: 'https://example.com/m/abc',
      createdAt: 'a',
      updatedAt: 'b',
      cards: [],
    },
  ],
  reports: [
    {
      cardCode: 'OP01-001',
      kind: 'report',
      reason: 'unclear',
      note: 'Non capisco il bonus',
      status: 'open',
      createdAt: 'a',
      updatedAt: 'b',
    },
  ],
}

describe('Esporta i miei dati', () => {
  it('celle CSV: separatore, virgolette, formule neutralizzate', () => {
    expect(csvCell('Nami')).toBe('Nami')
    expect(csvCell(4)).toBe('4')
    expect(csvCell('a;b')).toBe('"a;b"')
    expect(csvCell('detto "così"')).toBe('"detto ""così"""')
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('-1')).toBe("'-1")
  })

  it('CSV della Collection: BOM, intestazione, righe ordinate e abbinate al catalogo', () => {
    const csv = collectionCsv(DATA.collection, CATALOG)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.slice(1).split('\r\n')).toEqual([
      'Print ID;Card Code;Nome;Set;Nome del Set;Lingua;Quantità',
      'OP01-016;OP01-016;"Nami; ""la navigatrice""";OP-01;ROMANCE DAWN;EN;4',
      'OP01-016_p1;OP01-016;"Nami; ""la navigatrice""";OP-01;ROMANCE DAWN;JP;2',
      'OP01-025;OP01-025;Roronoa Zoro;OP-01;ROMANCE DAWN;EN;1',
      // Printing non più nel catalogo: la riga resta, con quello che si sa.
      'ZZ99-001;ZZ99-001;;;;FR;1',
      '',
    ])
  })

  it('nomi di file validi ovunque', () => {
    expect(safeFileName('Zoro: rosso/verde')).toBe('Zoro_ rosso_verde')
    expect(safeFileName('  ...  ')).toBe('Mazzo')
    expect(safeFileName('Fine. ')).toBe('Fine')
    expect(safeFileName('x'.repeat(100))).toHaveLength(60)
  })

  it('archivio: leggimi, profilo, Collection, Deck in JSON e come liste', () => {
    const files = new Map(exportFiles(DATA, CATALOG).map((f) => [f.name, f.content]))
    expect([...files.keys()]).toEqual([
      'LEGGIMI.txt',
      'profilo.json',
      'collezione.csv',
      'mazzi.json',
      'mazzi/Zoro_ rosso_verde.txt',
      'mazzi/zoro_ ROSSO_verde (2).txt',
      'segnalazioni.json',
    ])
    expect(JSON.parse(String(files.get('segnalazioni.json')))).toEqual({
      version: 1,
      exportedAt: DATA.exportedAt,
      reports: DATA.reports,
    })
    expect(JSON.parse(String(files.get('profilo.json')))).toEqual({
      version: 1,
      exportedAt: DATA.exportedAt,
      profile: DATA.profile,
    })
    expect(JSON.parse(String(files.get('mazzi.json')))).toEqual({
      version: 1,
      exportedAt: DATA.exportedAt,
      decks: DATA.decks,
    })
    expect(files.get('mazzi/Zoro_ rosso_verde.txt')).toBe('1xOP01-001\n4xOP01-016\n4xOP01-025\n')
    expect(files.get('mazzi/zoro_ ROSSO_verde (2).txt')).toBe('1xOP01-001\n')
    expect(files.get('LEGGIMI.txt')).toContain('@Ribo')
  })

  it('nome dell’archivio con Username e data', () => {
    expect(exportFileName(DATA)).toBe('op-codex-Ribo-2026-09-25.zip')
  })
})
