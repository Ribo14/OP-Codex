import { describe, expect, it } from 'vitest'
import { PREVIEW_JSON } from './fixtures/preview-set.ts'
import { candidateSets, parsePreviewSet, previewSetCode } from './preview-sync.ts'

describe('Preview Sync: quali Set cercare (ADR-0016)', () => {
  it('per ogni serie i 4 numeri dopo l’ultimo Set ufficiale, anche dentro codici doppi', () => {
    const official = ['OP-17', 'OP15-EB04', 'EB-03', 'ST-36', 'PRB-02', 'PROMO', 'OP-01']
    expect(candidateSets(official)).toEqual([
      'op18',
      'op19',
      'op20',
      'op21',
      'eb05',
      'eb06',
      'eb07',
      'eb08',
      'st37',
      'st38',
      'st39',
      'st40',
      'prb03',
      'prb04',
      'prb05',
      'prb06',
    ])
  })

  it('codice del Set come quelli ufficiali', () => {
    expect(previewSetCode('eb05')).toBe('EB-05')
    expect(previewSetCode('PRB03')).toBe('PRB-03')
    expect(() => previewSetCode('../x')).toThrow()
  })
})

describe('Preview Sync: dal JSON al catalogo', () => {
  const warnings: string[] = []
  const set = parsePreviewSet('eb05', PREVIEW_JSON, (m) => warnings.push(m))

  it('Set e carte nuove, in ordine di codice; scarta le righe non valide e le varianti SP', () => {
    expect(set).toMatchObject({ siteId: 'eb05', code: 'EB-05', name: 'TEST & PREVIEW' })
    expect(set.cards.map((c) => c.cardCode)).toEqual(['EB05-001', 'EB05-002', 'EB05-003'])
    // Codice non valido, immagine scartata (e quindi carta senza immagini), doppione.
    expect(warnings).toHaveLength(4)
  })

  it('i campi diventano quelli della Official Card List', () => {
    const [leader, character, event] = set.cards
    expect(leader).toMatchObject({
      category: 'Leader',
      cost: null,
      life: 4,
      power: 5000,
      counter: null,
      trigger: null,
      block: null,
      credit: null,
      keywords: ['Activate: Main', 'Once Per Turn'],
    })
    expect(character).toMatchObject({
      category: 'Character',
      cost: 6,
      life: null,
      power: 6000,
      counter: 1000,
      attributes: ['Wisdom'],
      effect: '[On Play] Play up to 1 card with the <Wisdom> attribute.',
      trigger: "[Trigger] Rest up to 1 of your opponent's Characters.",
      credit: 'Traduttore',
    })
    expect(event).toMatchObject({ category: 'Event', cost: 1, power: null, counter: null })
  })

  it('la prima immagine è la stampa base, le altre le varianti _p1, _p2…', () => {
    expect(set.cards[1]?.printings).toEqual([
      { printId: 'EB05-002', rarity: 'SR', image: 'eb05-002v2' },
      { printId: 'EB05-002_p1', rarity: 'SR', image: 'eb05-002a' },
    ])
  })

  it('un JSON senza carte è un errore', () => {
    expect(() => parsePreviewSet('eb05', { data: {} })).toThrow(/carte/)
    expect(() => parsePreviewSet('eb05', null)).toThrow()
  })
})
