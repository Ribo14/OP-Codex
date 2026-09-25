import { describe, expect, it } from 'vitest'
import { activeBanList, banKinds, banStatus, inForce, isoDay, type BanListEntry } from './ban-list'

let nextId = 1
const entry = (partial: Partial<BanListEntry> & Pick<BanListEntry, 'cardCode' | 'kind'>) => ({
  id: nextId++,
  maxCopies: null,
  pairCode: null,
  effectiveFrom: '2026-09-24',
  source: null,
  ...partial,
})

const ENTRIES: BanListEntry[] = [
  entry({ cardCode: 'OP06-047', kind: 'banned' }),
  entry({ cardCode: 'OP14-020', kind: 'banned', effectiveFrom: '2026-10-12' }),
  entry({ cardCode: 'OP01-001', kind: 'restricted', maxCopies: 1 }),
  entry({ cardCode: 'EB04-058', kind: 'pair', pairCode: 'OP07-115' }),
  entry({ cardCode: 'OP08-069', kind: 'pair', pairCode: 'OP11-040' }),
  entry({ cardCode: 'OP11-040', kind: 'pair', pairCode: 'OP11-067' }),
]

const BEFORE = new Date(2026, 9, 11) // 11 ottobre 2026
const AFTER = new Date(2026, 9, 12)

describe('Ban List', () => {
  it('applica solo le voci già in vigore', () => {
    expect(isoDay(BEFORE)).toBe('2026-10-11')
    expect(inForce(ENTRIES, BEFORE).map((e) => e.cardCode)).not.toContain('OP14-020')
    expect(inForce(ENTRIES, AFTER).map((e) => e.cardCode)).toContain('OP14-020')
  })

  it('diventa la Ban List del modulo Deck Rules', () => {
    const list = activeBanList(ENTRIES, AFTER)
    expect([...list.banned]).toEqual(['OP06-047', 'OP14-020'])
    expect([...list.restricted]).toEqual([['OP01-001', 1]])
    expect(list.pairs).toEqual([
      ['EB04-058', 'OP07-115'],
      ['OP08-069', 'OP11-040'],
      ['OP11-040', 'OP11-067'],
    ])
  })

  it('stato di una carta per i tag: bandita, limitata, coppie in entrambe le direzioni', () => {
    expect(banStatus('OP06-047', ENTRIES, AFTER)).toMatchObject({ banned: true, pairedWith: [] })
    expect(banStatus('OP01-001', ENTRIES, AFTER)).toMatchObject({ banned: false, restricted: 1 })
    expect(banStatus('OP11-040', ENTRIES, AFTER)?.pairedWith).toEqual(['OP08-069', 'OP11-067'])
    expect(banStatus('OP07-115', ENTRIES, AFTER)?.pairedWith).toEqual(['EB04-058'])
    expect(banStatus('OP01-002', ENTRIES, AFTER)).toBeNull()
  })

  it('tag per la griglia: bandita prima di limitata e coppia, entrambe le carte della coppia', () => {
    const kinds = banKinds(
      [...ENTRIES, entry({ cardCode: 'OP06-047', kind: 'pair', pairCode: 'OP09-001' })],
      AFTER,
    )
    expect(kinds.get('OP06-047')).toBe('banned')
    expect(kinds.get('OP09-001')).toBe('pair')
    expect(kinds.get('OP07-115')).toBe('pair')
    expect(kinds.get('OP01-001')).toBe('restricted')
    expect(banKinds(ENTRIES, BEFORE).has('OP14-020')).toBe(false)
  })

  it('una voce futura si annuncia ma non vale ancora', () => {
    expect(banStatus('OP14-020', ENTRIES, BEFORE)).toEqual({
      banned: false,
      restricted: null,
      pairedWith: [],
      upcoming: { kind: 'banned', from: '2026-10-12' },
    })
    expect(banStatus('OP14-020', ENTRIES, AFTER)).toMatchObject({ banned: true, upcoming: null })
  })
})
