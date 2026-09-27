import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkRecipes } from './recipe-sync.ts'

// Composizione degli Starter Deck: il file del repo deve essere sempre valido (51 carte per
// mazzo, quantità da 1 a 4), altrimenti il job si ferma prima di scrivere.

const file = JSON.parse(
  readFileSync(new URL('./decks/starter-decks.json', import.meta.url), 'utf8'),
) as { decks: Record<string, Record<string, number>> }

describe('starter-decks.json', () => {
  it('è valido: ogni mazzo ha 51 carte (Leader + 50)', () => {
    expect(checkRecipes(file)).toEqual([])
    expect(Object.keys(file.decks).length).toBeGreaterThanOrEqual(14)
  })

  it('ST-01 ha il Leader una volta e le carte a 4 o 2 copie', () => {
    const st01 = file.decks['ST-01'] ?? {}
    expect(st01['ST01-001']).toBe(1)
    expect(Object.values(st01).reduce((a, b) => a + b, 0)).toBe(51)
  })
})

describe('checkRecipes', () => {
  it('segnala totali sbagliati, quantità impossibili e codici non validi', () => {
    expect(
      checkRecipes({
        source: 'prova',
        decks: { 'ST-99': { 'ST99-001': 1, 'ST99-002': 5, 'non valido': 2 } },
      }),
    ).toEqual([
      'ST-99: ST99-002 ha 5 copie',
      'ST-99: Card Code non valido non valido',
      'ST-99: 3 carte invece di 51',
    ])
  })

  it('senza fonte o senza mazzi il file non va', () => {
    expect(checkRecipes({ decks: {} })).toEqual(['manca "source"'])
    expect(checkRecipes(null)).toEqual(['il file non è un oggetto'])
  })
})
