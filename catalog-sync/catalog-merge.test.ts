import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { parseCardListPage, parseSeriesList } from './card-list-parser.ts'
import { mergeCatalogPages } from './catalog-merge.ts'

const html = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}.html`, import.meta.url), 'utf8')

const op01 = parseCardListPage(html('op-01'))
const st01 = parseCardListPage(html('st-01'))
const prb01 = parseCardListPage(html('prb-01'))

describe('parseSeriesList', () => {
  const series = parseSeriesList(html('op-01'))

  it('legge tutti i Set del menu, senza le voci vuote', () => {
    expect(series).toHaveLength(60)
    expect(new Set(series.map((s) => s.code)).size).toBe(60)
  })

  it('riconosce booster, starter, premium, promo e prodotti vari', () => {
    const byCode = new Map(series.map((s) => [s.code, s]))
    expect(byCode.get('OP-01')).toEqual({
      seriesId: 569101,
      code: 'OP-01',
      name: 'ROMANCE DAWN',
      productType: 'BOOSTER PACK',
    })
    expect(byCode.get('ST-01')?.seriesId).toBe(569001)
    expect(byCode.get('PRB-01')?.seriesId).toBe(569301)
    expect(byCode.get('OP15-EB04')?.seriesId).toBe(569115)
    expect(byCode.get('PROMO')?.seriesId).toBe(569901)
    expect(byCode.get('OTHER')?.seriesId).toBe(569801)
  })
})

describe('mergeCatalogPages', () => {
  it('unisce Set, Card e Printing senza duplicati', () => {
    const catalog = mergeCatalogPages([op01, st01, prb01])

    expect(catalog.sets.map((s) => s.code)).toEqual(['ST-01', 'OP-01', 'PRB-01'])
    expect(catalog.printings).toHaveLength(154 + 17 + 319)
    const cardCodes = catalog.cards.map((c) => c.cardCode)
    expect(new Set(cardCodes).size).toBe(cardCodes.length)
  })

  it('le ristampe si agganciano alla Card esistente e al proprio Set', () => {
    const catalog = mergeCatalogPages([op01, prb01])

    const otama = catalog.printings.filter((p) => p.cardCode === 'OP01-006')
    expect(otama.map((p) => [p.printId, p.seriesId])).toEqual([
      ['OP01-006', 569101],
      ['OP01-006_p3', 569301],
      ['OP01-006_p4', 569301],
      ['OP01-006_p5', 569301],
      ['OP01-006_r1', 569301],
    ])
    expect(catalog.cards.filter((c) => c.cardCode === 'OP01-006')).toHaveLength(1)
  })

  it('prende i dati della Card dalla Printing base, in qualunque ordine arrivino le pagine', () => {
    // Una ristampa con un testo diverso (es. errata) non deve sovrascrivere la Card.
    const reprint = structuredClone(prb01)
    const otama = reprint.cards.find((c) => c.cardCode === 'OP01-006')
    if (!otama) throw new Error('OP01-006 mancante nella fixture')
    otama.effect = 'Testo della ristampa'

    for (const pages of [
      [op01, reprint],
      [reprint, op01],
    ]) {
      const card = mergeCatalogPages(pages).cards.find((c) => c.cardCode === 'OP01-006')
      expect(card?.effect).toBe(op01.cards.find((c) => c.cardCode === 'OP01-006')?.effect)
    }
  })

  it('un Print ID ripetuto in due Set resta collegato al primo per series_id', () => {
    const copy = structuredClone(st01)
    copy.set = { seriesId: 569999, code: 'TEST', name: 'Test', productType: null }

    const catalog = mergeCatalogPages([copy, st01])

    expect(catalog.duplicatePrintIds).toHaveLength(17)
    expect(catalog.printings.find((p) => p.printId === 'ST01-001')?.seriesId).toBe(569001)
  })
})
