import { describe, expect, it } from 'vitest'
import rulesDoc from './comprehensive-rules.json'
import { parentOf, parseRulesText } from './rules-text'

// Comprehensive Rules in testo strutturato (RIB-53).

const SAMPLE = `                    ONE PIECE CARD GAME Comprehensive Rules
                                    Version 1.2.1
Last updated: 8/28/2026
Table of Contents
1. Game Overview .......................................... 1
1. Game Overview
   1-1. Number of Players
      1-1-1. This game is played between two players. If you have carried out
             4-5-4-2 X times, return to 4-5-
             4-1.

                                                                  1
      1-1-2. Place it under your Leader (see 6-6-1-
             1.) and rest it. Only 7
             or less cards.
2-13 Rarity
      2-13-1. This specifies the card's rarity.
2.4. Wrong
8.4. Activation and Resolution
`

describe('estrazione del regolamento', () => {
  const doc = parseRulesText(SAMPLE)

  it('versione, data, regole numerate con il testo sulle righe successive', () => {
    expect(doc.version).toBe('1.2.1')
    expect(doc.updated).toBe('8/28/2026')
    expect(doc.rules.map((r) => r.n)).toEqual([
      '1',
      '1-1',
      '1-1-1',
      '1-1-2',
      '2-13',
      '2-13-1',
      '2-4',
    ])
    expect(doc.rules[2]?.t).toBe(
      'This game is played between two players. If you have carried out 4-5-4-2 X times, return to 4-5-4-1.',
    )
  })

  it('i rimandi e i numeri andati a capo restano testo; niente numeri di pagina', () => {
    expect(doc.rules[3]?.t).toBe(
      'Place it under your Leader (see 6-6-1-1.) and rest it. Only 7 or less cards.',
    )
  })

  it('un capitolo che salta non viene preso per una regola', () => {
    // "8.4." arriva mentre si è nel capitolo 2: è fuori sequenza e resta testo di 2-4.
    expect(doc.rules.at(-1)?.t).toBe('Wrong 8.4. Activation and Resolution')
  })

  it('parentOf', () => {
    expect(parentOf('10-1-4-1')).toBe('10-1-4')
    expect(parentOf('10')).toBeNull()
  })
})

describe('regolamento estratto nel repo', () => {
  const { rules } = rulesDoc
  const numbers = new Set(rules.map((r) => r.n))

  it('ogni regola ha il suo genitore e nessun numero è ripetuto', () => {
    expect(numbers.size).toBe(rules.length)
    expect(
      rules.filter((r) => parentOf(r.n) !== null && !numbers.has(parentOf(r.n) ?? '')),
    ).toEqual([])
  })

  it('a campione su più capitoli', () => {
    const text = (n: string) => rules.find((r) => r.n === n)?.t
    expect(text('1')).toBe('Game Overview')
    expect(text('2-13')).toBe('Rarity')
    expect(text('6-5-5-2')).toMatch(/^Leader cards and Character cards gain 1000 power/)
    expect(text('8-4')).toBe('Activation and Resolution')
    expect(text('10-1-4-1')).toMatch(/^\[Blocker\] is a keyword effect/)
    expect(text('11-3-3')).toMatch(/original state\.$/)
  })
})
