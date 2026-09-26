import { describe, expect, it } from 'vitest'
import type { CatalogCard } from '@/catalog/catalog-data'
import {
  ancestorsOf,
  highlight,
  ruleContext,
  searchFaqs,
  searchRules,
  searchWords,
} from './rules-search'
import type { Rule } from './rules-text'

// Rules Search (RIB-53): regolamento e FAQ, sul dispositivo.

const RULES: Rule[] = [
  { n: '10', t: 'Keyword Effects and Keywords' },
  { n: '10-1', t: 'Keyword Effects' },
  { n: '10-1-4', t: '[Blocker]' },
  { n: '10-1-4-1', t: '[Blocker] is a keyword effect… resting this card during the Block Step.' },
  { n: '10-1-5', t: '[Trigger]' },
  { n: '10-2', t: 'Keywords' },
  { n: '10-2-14', t: 'Trash' },
]

const card = (cardCode: string, faqs: CatalogCard['faqs']): CatalogCard => ({
  cardCode,
  name: 'Nami',
  category: 'Leader',
  cost: null,
  life: 5,
  power: 5000,
  counter: null,
  colors: [],
  attributes: [],
  types: [],
  block: null,
  effect: null,
  trigger: null,
  keywords: [],
  printings: [],
  faqs,
})

describe('ricerca nel regolamento', () => {
  it('tutte le parole, senza maiuscole, nell’ordine del regolamento', () => {
    expect(searchRules(RULES, 'BLOCKER').map((r) => r.n)).toEqual(['10-1-4', '10-1-4-1'])
    expect(searchRules(RULES, 'blocker step').map((r) => r.n)).toEqual(['10-1-4-1'])
    expect(searchRules(RULES, '   ')).toEqual([])
  })

  it('un numero trova la regola e le sue sotto-regole', () => {
    expect(searchRules(RULES, '10-1-4').map((r) => r.n)).toEqual(['10-1-4', '10-1-4-1'])
    expect(searchRules(RULES, '10-1-4.').map((r) => r.n)).toEqual(['10-1-4', '10-1-4-1'])
  })

  it('contesto e titoli sopra una regola', () => {
    expect(ruleContext(RULES, '10-1-4-1').map((r) => r.n)).toEqual(['10-1-4', '10-1-4-1'])
    expect(ruleContext(RULES, '10').map((r) => r.n)).toHaveLength(RULES.length)
    expect(ancestorsOf(RULES, '10-1-4-1').map((r) => r.n)).toEqual(['10', '10-1', '10-1-4'])
  })
})

describe('ricerca nelle FAQ', () => {
  const cards = [
    card('OP03-040', [{ question: 'Can I win when my deck is 0?', answer: 'Yes.', source: 'q' }]),
    card('OP01-001', [{ question: 'Does it stack?', answer: 'No.', source: 'q' }]),
  ]

  it('cerca in domanda, risposta, nome e codice della carta', () => {
    expect(searchFaqs(cards, 'deck win').map((h) => h.card.cardCode)).toEqual(['OP03-040'])
    expect(searchFaqs(cards, 'op01-001').map((h) => h.faq.answer)).toEqual(['No.'])
    // L'apostrofo tipografico dei PDF vale come quello dritto.
    expect(searchWords('Opponent’s')).toEqual(["opponent's"])
  })
})

describe('evidenziazione', () => {
  it('segna i pezzi trovati, senza badare a maiuscole', () => {
    expect(highlight('Rest this Blocker', ['blocker', 'rest'])).toEqual([
      { text: 'Rest', hit: true },
      { text: ' this ', hit: false },
      { text: 'Blocker', hit: true },
    ])
    expect(highlight('niente', [])).toEqual([{ text: 'niente', hit: false }])
  })
})
