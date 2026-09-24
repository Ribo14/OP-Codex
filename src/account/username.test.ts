import { describe, expect, it } from 'vitest'
import { usernameProblem } from './username'

describe('regole dello Username', () => {
  it('accetta lettere, cifre e _ tra 3 e 20 caratteri', () => {
    for (const ok of ['abc', 'Ribo', 'luffy_2026', 'A'.repeat(20)]) {
      expect(usernameProblem(ok), ok).toBeNull()
    }
  })

  it('rifiuta lunghezze, caratteri non ammessi e nomi riservati', () => {
    expect(usernameProblem('ab')).toBe('length')
    expect(usernameProblem('a'.repeat(21))).toBe('length')
    expect(usernameProblem('con spazio')).toBe('characters')
    expect(usernameProblem('àccento')).toBe('characters')
    expect(usernameProblem('a.b.c')).toBe('characters')
    expect(usernameProblem('Admin')).toBe('reserved')
    expect(usernameProblem('OPCODEX')).toBe('reserved')
  })
})
