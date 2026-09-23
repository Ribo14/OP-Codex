import { describe, expect, it } from 'vitest'
import it_ from './it.json'

function leaves(value: unknown, path = ''): [string, unknown][] {
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k))
  }
  return [[path, value]]
}

describe('testi italiani', () => {
  it('ogni chiave ha un testo non vuoto', () => {
    for (const [key, text] of leaves(it_)) {
      expect(typeof text, key).toBe('string')
      expect(String(text).trim(), key).not.toBe('')
    }
  })

  it('contiene l’avviso Bandai richiesto', () => {
    expect(it_.footer.disclaimer).toBe(
      'Progetto amatoriale non affiliato a Bandai. ONE PIECE © Eiichiro Oda/Shueisha, Toei Animation',
    )
  })
})
