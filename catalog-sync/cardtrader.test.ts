import { describe, expect, it } from 'vitest'
import {
  cheapestEuroCents,
  mapCardTrader,
  parseBlueprints,
  parseExpansions,
  parseMarketplace,
  type CardTraderOffer,
} from './cardtrader.ts'

// Prezzi CardTrader (RIB-32, slice 5.5): risposte dell'API v2 ridotte ai campi usati, abbinamento
// incrociato tramite gli id Cardmarket dei blueprint, prezzo minimo in euro.

describe('parseExpansions', () => {
  it('tiene solo le espansioni di One Piece (gioco 15)', () => {
    expect(
      parseExpansions([
        { id: 1, game_id: 1, code: 'gnt', name: 'Game Night' },
        { id: 3001, game_id: 15, code: 'op01', name: 'Romance Dawn' },
        { id: 'x', game_id: 15 },
      ]),
    ).toEqual([{ id: 3001, name: 'Romance Dawn' }])
  })

  it('fallisce se la risposta non è un elenco', () => {
    expect(() => parseExpansions({ error: 'Unauthorized' })).toThrow(/espansioni/)
  })
})

describe('parseBlueprints', () => {
  it('tiene le carte singole (categoria 192) con i loro id Cardmarket', () => {
    expect(
      parseBlueprints([
        { id: 10, category_id: 192, card_market_ids: [690368, 768234], name: 'Roronoa Zoro' },
        { id: 11, category_id: 193, card_market_ids: [700000], name: 'Booster Box' },
        { id: 12, category_id: 192, card_market_ids: null, name: 'Senza id' },
      ]),
    ).toEqual([
      { id: 10, cardMarketIds: [690368, 768234] },
      { id: 12, cardMarketIds: [] },
    ])
  })
})

describe('parseMarketplace', () => {
  it('raggruppa le offerte per blueprint, con prezzo, valuta e proprietà', () => {
    const offers = parseMarketplace({
      '10': [
        {
          id: 1,
          blueprint_id: 10,
          quantity: 2,
          price: { cents: 250, currency: 'EUR' },
          graded: false,
          properties_hash: {
            condition: 'Near Mint',
            onepiece_language: 'en',
            onepiece_foil: false,
          },
        },
        { id: 2, blueprint_id: 10, quantity: 1, price_cents: 199, price_currency: 'EUR' },
      ],
    })
    expect(offers.get(10)).toEqual([
      {
        cents: 250,
        currency: 'EUR',
        quantity: 2,
        graded: false,
        condition: 'Near Mint',
        language: 'en',
      },
      { cents: 199, currency: 'EUR', quantity: 1, graded: false, condition: null, language: null },
    ])
  })
})

describe('cheapestEuroCents', () => {
  const offer = (partial: Partial<CardTraderOffer>): CardTraderOffer => ({
    cents: 100,
    currency: 'EUR',
    quantity: 1,
    graded: false,
    condition: 'Near Mint',
    language: 'en',
    ...partial,
  })

  it('il minimo tra le offerte inglesi, Near Mint o Mint, non gradate, in euro', () => {
    expect(
      cheapestEuroCents([
        offer({ cents: 300 }),
        offer({ cents: 120, condition: 'Mint' }),
        offer({ cents: 50, condition: 'Played' }),
        offer({ cents: 40, language: 'jp' }),
        offer({ cents: 30, graded: true }),
        offer({ cents: 20, currency: 'USD' }),
        offer({ cents: 10, quantity: 0 }),
      ]),
    ).toBe(120)
  })

  it('condizione o lingua non indicate valgono come Near Mint e inglese', () => {
    expect(cheapestEuroCents([offer({ cents: 90, condition: null, language: null })])).toBe(90)
  })

  it('senza offerte valide: null', () => {
    expect(cheapestEuroCents([])).toBeNull()
    expect(cheapestEuroCents([offer({ currency: 'USD' })])).toBeNull()
  })
})

describe('mapCardTrader', () => {
  const cardmarket = new Map([
    ['OP01-001', 690368],
    ['OP01-001_p1', 690369],
    ['OP01-004', 690370],
    ['OP01-016', 690400],
  ])

  it('a ogni Printing il blueprint che contiene il suo prodotto Cardmarket', () => {
    const result = mapCardTrader(cardmarket, [
      { id: 10, cardMarketIds: [690368, 768234] },
      { id: 11, cardMarketIds: [690369] },
      { id: 12, cardMarketIds: [690370] },
    ])
    expect(result).toEqual(
      new Map([
        ['OP01-001', 10],
        ['OP01-001_p1', 11],
        ['OP01-004', 12],
      ]),
    )
  })

  it('un prodotto Cardmarket in due blueprint è ambiguo: nessun abbinamento', () => {
    const result = mapCardTrader(cardmarket, [
      { id: 20, cardMarketIds: [690400] },
      { id: 21, cardMarketIds: [690400] },
    ])
    expect(result.has('OP01-016')).toBe(false)
  })
})
