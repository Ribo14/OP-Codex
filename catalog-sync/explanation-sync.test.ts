import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { collectExplanations, MAX_EXPLANATION_LENGTH } from './explanation-sync.ts'

// Card Explanation (RIB-52): i file del repo devono essere sani, altrimenti il job non carica nulla.

const DIR = new URL('./explanations/', import.meta.url)

describe('file delle spiegazioni', () => {
  it('raccoglie le voci per Card Code', () => {
    const { byCard, problems } = collectExplanations([
      { name: 'op01.json', content: [{ cardCode: 'OP01-001', body: ' Testo. ' }] },
      { name: 'op02.json', content: [{ cardCode: 'OP02-001', body: 'Altro.' }] },
    ])
    expect(problems).toEqual([])
    expect([...byCard]).toEqual([
      ['OP01-001', 'Testo.'],
      ['OP02-001', 'Altro.'],
    ])
  })

  it('segnala file e voci non valide', () => {
    const { problems } = collectExplanations([
      { name: 'rotto.json', content: { cardCode: 'OP01-001' } },
      {
        name: 'op01.json',
        content: [
          { cardCode: 'op01-001', body: 'minuscole' },
          { cardCode: 'OP01-002', body: '  ' },
          { cardCode: 'OP01-003', body: 'x'.repeat(MAX_EXPLANATION_LENGTH + 1) },
          { cardCode: 'OP01-004', body: 'ok' },
          { cardCode: 'OP01-004', body: 'doppione' },
        ],
      },
    ])
    expect(problems).toEqual([
      'rotto.json: non è un elenco',
      'op01.json #1: Card Code non valido',
      'op01.json #2 (OP01-002): testo vuoto',
      `op01.json #3 (OP01-003): testo oltre ${String(MAX_EXPLANATION_LENGTH)} caratteri`,
      'op01.json #5: OP01-004 ripetuto',
    ])
  })

  it('i file del repo sono validi', () => {
    const files = readdirSync(DIR)
      .filter((name) => name.endsWith('.json'))
      .map((name) => ({
        name,
        content: JSON.parse(readFileSync(new URL(name, DIR), 'utf8')) as unknown,
      }))
    expect(files.length).toBeGreaterThan(0)
    expect(collectExplanations(files).problems).toEqual([])
  })
})
