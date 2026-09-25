import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { cleanFaqText, faqsByCard, type RawFaqRow } from './faq-sync.ts'

const raw = JSON.parse(
  readFileSync(new URL('./faq/faq-raw.json', import.meta.url), 'utf8'),
) as RawFaqRow[]

const row = (cardCode: string, question: string, answer: string, source = 'qa_op01.pdf') => ({
  source,
  page: 1,
  cardCode,
  cardName: 'Prova',
  question,
  answer,
})

describe('testo delle FAQ', () => {
  it('unisce le righe della colonna con uno spazio', () => {
    expect(
      cleanFaqText('Can I use this [On Play] effect to add a non-red {Straw\nHat Crew}?'),
    ).toBe('Can I use this [On Play] effect to add a non-red {Straw Hat Crew}?')
  })

  it('a fine riga il trattino unisce senza spazio (−2000, codici, parole composte)', () => {
    expect(cleanFaqText('give my Leader −\n2000 power')).toBe('give my Leader −2000 power')
    expect(cleanFaqText('their "EB03-\n031 Vinsmoke Reiju"')).toBe(
      'their "EB03-031 Vinsmoke Reiju"',
    )
    expect(cleanFaqText('face-\nup Life cards')).toBe('face-up Life cards')
  })

  it('<br> letterale e note con * vanno a capo', () => {
    expect(cleanFaqText('Yes, you can.<br>While looking at your\ndeck, the number is not 0.')).toBe(
      'Yes, you can.\nWhile looking at your deck, the number is not 0.',
    )
    expect(cleanFaqText('No, you cannot.<br> All instructions<br>')).toBe(
      'No, you cannot.\nAll instructions',
    )
    expect(cleanFaqText('Yes, you can.\n*This card is subject to a special ruling.')).toBe(
      'Yes, you can.\n*This card is subject to a special ruling.',
    )
  })
})

describe('FAQ per carta', () => {
  it('nell’ordine dei PDF, senza doppioni tra un PDF e l’altro', () => {
    const faqs = faqsByCard([
      row('OP16-040', 'Q1', 'A1', 'qa_op16.pdf'),
      row('OP16-040', 'Q2\ncontinua', 'A2', 'qa_op16.pdf'),
      row('OP01-001', 'Q', 'A'),
      row('OP16-040', 'Q2 continua', 'A2', 'qa_op17.pdf'),
    ])
    expect(faqs.get('OP16-040')).toEqual([
      { question: 'Q1', answer: 'A1', source: 'qa_op16.pdf' },
      { question: 'Q2 continua', answer: 'A2', source: 'qa_op16.pdf' },
    ])
    expect(faqs.get('OP01-001')).toHaveLength(1)
  })

  it('il file estratto da tutti i PDF: Card Code validi e testo pulito', () => {
    const faqs = faqsByCard(raw)
    const all = [...faqs.values()].flat()
    expect(all.length).toBeGreaterThan(1300)
    expect(faqs.size).toBeGreaterThan(900)
    for (const code of faqs.keys()) expect(code).toMatch(/^[A-Z]+\d*-\d{3}$/)
    for (const faq of all) {
      expect(faq.question).not.toMatch(/<br|\s{2}/i)
      expect(faq.answer).not.toMatch(/<br|\s{2}/i)
    }
  })

  // Campione da tre gruppi di PDF diversi (booster, Starter Deck, Extra Booster), confrontato a
  // mano con i PDF ufficiali.
  it('campione: OP01-016, ST01-012 ed EB02-010 hanno le loro FAQ', () => {
    const faqs = faqsByCard(raw)
    const nami = faqs.get('OP01-016') ?? []
    expect(nami).toHaveLength(4)
    expect(nami[0]).toMatchObject({
      question: expect.stringContaining('non-red {Straw Hat Crew} type') as string,
      answer: 'Yes, you can.',
      source: 'qa_op01.pdf',
    })
    expect(nami[2]?.answer).toContain('deck.\nWhile looking at your deck')
    expect(faqs.get('ST01-012')?.[0]).toMatchObject({
      question: expect.stringMatching(/^Can my opponent activate \[Blocker\]/) as string,
      source: 'qa_st-01-st-04.pdf',
    })
    expect(faqs.get('EB02-010')?.[0]?.source).toBe('qa_eb02.pdf')
    // Ripetuta in qa_op17.pdf: una volta sola.
    expect(faqs.get('OP16-040')).toHaveLength(2)
  })
})
