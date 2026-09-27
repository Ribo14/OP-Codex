import { describe, expect, it } from 'vitest'
import type { CatalogCard } from '@/catalog/catalog-data'
import { listRows, payload, setRows } from './bulk-add'

// Aggiunta in blocco alla Collection: da un Set intero o da una lista "4xST01-001".

const card = (cardCode: string, category: string, printings: [string, string][]): CatalogCard => ({
  cardCode,
  name: `Nome ${cardCode}`,
  category,
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
  printings: printings.map(([printId, setCode]) => ({
    printId,
    rarity: 'C',
    setCode,
    hasImage: false,
  })),
})

const cards = [
  card('ST01-001', 'Leader', [['ST01-001', 'ST-01']]),
  card('ST01-004', 'Character', [
    ['ST01-004', 'ST-01'],
    ['ST01-004_p1', 'PROMO'],
  ]),
  card('OP01-004', 'Character', [
    ['OP01-004', 'OP-01'],
    ['OP01-004_p1', 'OP-01'],
    ['OP01-004_r1', 'PRB-01'],
  ]),
]
const byCode = new Map(cards.map((c) => [c.cardCode, c]))

describe('setRows', () => {
  it('le stampe del Set: una copia delle base e delle ristampe, zero delle parallele', () => {
    expect(setRows(cards, 'OP-01').map((r) => [r.printId, r.quantity])).toEqual([
      ['OP01-004', 1],
      ['OP01-004_p1', 0],
    ])
    expect(setRows(cards, 'PRB-01').map((r) => [r.printId, r.quantity])).toEqual([
      ['OP01-004_r1', 1],
    ])
  })

  it('le stampe di altri Set della stessa carta non ci sono', () => {
    expect(setRows(cards, 'ST-01').map((r) => r.printId)).toEqual(['ST01-001', 'ST01-004'])
  })

  it('con la composizione del mazzo propone le copie esatte sulla stampa del Set', () => {
    const recipe = { 'ST01-001': 1, 'ST01-004': 4 }
    expect(setRows(cards, 'ST-01', recipe).map((r) => [r.printId, r.quantity])).toEqual([
      ['ST01-001', 1],
      ['ST01-004', 4],
    ])
  })

  it('una ristampa nel mazzo va sulla sua stampa del Set; le carte fuori composizione a 0', () => {
    const recipe = { 'OP01-004': 4 }
    expect(setRows(cards, 'PRB-01', recipe).map((r) => [r.printId, r.quantity])).toEqual([
      ['OP01-004_r1', 4],
    ])
    expect(setRows(cards, 'OP-01', { 'ST01-004': 2 }).map((r) => [r.printId, r.quantity])).toEqual([
      // Carta della composizione senza stampa nel Set (dati incompleti): la sua base.
      ['ST01-004', 2],
      ['OP01-004', 0],
      ['OP01-004_p1', 0],
    ])
  })
})

describe('listRows', () => {
  it('legge la lista: Leader compresi, righe ripetute sommate, parallele come base', () => {
    const { rows, errors } = listRows(
      '1xST01-001\n4xST01-004\n2 x ST01-004_p1\n# commento\nOP01-004 x3\nST01-001',
      byCode,
    )
    expect(rows.map((r) => [r.printId, r.quantity])).toEqual([
      ['ST01-001', 2],
      ['ST01-004', 6],
      ['OP01-004', 3],
    ])
    expect(errors).toEqual([])
  })

  it('segnala le righe illeggibili e i codici inesistenti, con il numero di riga', () => {
    const { rows, errors } = listRows('4xST01-004\nciao\n2xZZ99-001\n0xST01-001', byCode)
    expect(rows.map((r) => r.printId)).toEqual(['ST01-004'])
    expect(errors).toEqual([
      { line: 2, text: 'ciao', problem: 'format' },
      { line: 3, text: '2xZZ99-001', problem: 'unknown' },
      { line: 4, text: '0xST01-001', problem: 'format' },
    ])
  })
})

describe('payload', () => {
  it('solo le righe con copie, nella lingua scelta, al massimo 99 per stampa', () => {
    expect(
      payload(
        [
          { printId: 'A-001', cardCode: 'A-001', name: 'A', rarity: 'C', quantity: 2 },
          { printId: 'B-001', cardCode: 'B-001', name: 'B', rarity: 'C', quantity: 0 },
          { printId: 'C-001', cardCode: 'C-001', name: 'C', rarity: 'C', quantity: 150 },
        ],
        'JP',
      ),
    ).toEqual([
      { print_id: 'A-001', language: 'JP', quantity: 2 },
      { print_id: 'C-001', language: 'JP', quantity: 99 },
    ])
  })
})
