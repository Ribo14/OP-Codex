import { describe, expect, it } from 'vitest'
import { entryForKeyword, GLOSSARY } from './glossary'

// Le Keyword estratte dal Catalog Sync su tutto il catalogo di produzione (2026-09-26, 2.785
// Card). Se il sync ne trova una nuova, va aggiunta qui e nel glossario.
const CATALOG_KEYWORDS = [
  'On Play',
  'Trigger',
  'Activate: Main',
  'Blocker',
  'Once Per Turn',
  'Main',
  'When Attacking',
  'Counter',
  'DON!! x1',
  'On K.O.',
  'Your Turn',
  'Rush',
  "Opponent's Turn",
  "On Your Opponent's Attack",
  'End of Your Turn',
  'DON!! x2',
  'Double Attack',
  'Banish',
  'On Block',
  'Rush: Character',
  'Unblockable',
  'DON!! x3',
]

describe('glossario', () => {
  it('ogni Keyword del catalogo ha una voce', () => {
    const missing = CATALOG_KEYWORDS.filter((k) => !entryForKeyword(k))
    expect(missing).toEqual([])
  })

  it('DON!! xN e DON!! −N portano alla stessa voce qualunque sia il numero', () => {
    expect(entryForKeyword('DON!! x3')?.id).toBe('don-x')
    expect(entryForKeyword('DON!! -2')?.id).toBe('don-minus')
    expect(entryForKeyword('DON!! −1')?.id).toBe('don-minus')
  })

  it('non confonde i nomi delle carte con le Keyword', () => {
    expect(entryForKeyword('Monkey.D.Luffy')).toBeUndefined()
  })

  it('id unici, testi non vuoti e numero di regola', () => {
    expect(new Set(GLOSSARY.map((e) => e.id)).size).toBe(GLOSSARY.length)
    for (const entry of GLOSSARY) {
      expect(entry.summary.length).toBeGreaterThan(10)
      expect(entry.body.length).toBeGreaterThan(0)
      expect(entry.rule).toMatch(/^\d+(-\d+)*(, \d+(-\d+)*)*$/)
    }
  })
})
