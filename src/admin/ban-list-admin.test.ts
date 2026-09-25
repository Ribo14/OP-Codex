import { describe, expect, it } from 'vitest'
import { normalizeDraft, type BanDraft } from './ban-list-admin'

const draft = (partial: Partial<BanDraft>): BanDraft => ({
  cardCode: 'op06-047 ',
  kind: 'banned',
  maxCopies: null,
  pairCode: null,
  effectiveFrom: '2026-10-12',
  source: '  Avviso  ',
  ...partial,
})

describe('voci della Ban List dall’area Admin', () => {
  it('normalizza codici e fonte, e svuota i campi che il tipo non usa', () => {
    expect(normalizeDraft(draft({ maxCopies: 2, pairCode: 'OP01-001' }))).toEqual({
      cardCode: 'OP06-047',
      kind: 'banned',
      maxCopies: null,
      pairCode: null,
      effectiveFrom: '2026-10-12',
      source: 'Avviso',
    })
  })

  it('una limitata vuole copie da 0 a 3', () => {
    expect(normalizeDraft(draft({ kind: 'restricted' }))).toBe('maxCopies')
    expect(normalizeDraft(draft({ kind: 'restricted', maxCopies: 4 }))).toBe('maxCopies')
    expect(normalizeDraft(draft({ kind: 'restricted', maxCopies: 1 }))).toMatchObject({
      maxCopies: 1,
    })
  })

  it('una coppia vuole l’altra carta, diversa, e la mette in ordine', () => {
    expect(normalizeDraft(draft({ kind: 'pair' }))).toBe('pairCode')
    expect(normalizeDraft(draft({ kind: 'pair', pairCode: 'OP06-047' }))).toBe('samePair')
    expect(
      normalizeDraft(draft({ cardCode: 'OP11-067', kind: 'pair', pairCode: 'op11-040' })),
    ).toMatchObject({ cardCode: 'OP11-040', pairCode: 'OP11-067' })
  })

  it('rifiuta codici e date malformati', () => {
    expect(normalizeDraft(draft({ cardCode: 'Nami' }))).toBe('code')
    expect(normalizeDraft(draft({ effectiveFrom: '12/10/2026' }))).toBe('date')
  })
})
