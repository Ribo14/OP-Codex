import { describe, expect, it } from 'vitest'
import { cardCodesIn, recognize } from './scan-recognizer'

// Scan Recognizer (fase 4, slice 4.1): dal testo grezzo dell'OCR sulla zona in basso a destra
// della carta al Card Code. Testi realistici: rarità accanto al codice, rumore, errori tipici.

describe('cardCodesIn', () => {
  it.each([
    // Letture pulite, una per forma di Card Code.
    ['OP01-001', ['OP01-001']],
    ['ST01-012 SR', ['ST01-012']],
    ['EB01-006', ['EB01-006']],
    ['PRB01-001', ['PRB01-001']],
    ['P-001', ['P-001']],
    // Minuscole, spazi e trattini diversi.
    ['op05-119', ['OP05-119']],
    ['OP05 - 119', ['OP05-119']],
    ['OP05–119', ['OP05-119']],
    ['OP05_119', ['OP05-119']],
    // Errori tipici: O↔0, I/l↔1, S↔5, B↔8, Z↔2, G↔6.
    ['0P01-001', ['OP01-001']],
    ['OPO1-OO1', ['OP01-001']],
    ['OP0l-l20', ['OP01-120']],
    ['5T10-001', ['ST10-001']],
    ['E801-061', ['EB01-061']],
    ['PR801-O96', ['PRB01-096']],
    ['OP12-1Z0', ['OP12-120']],
    ['OP09-O0G', ['OP09-006']],
    ['ST0S-OO4', ['ST05-004']],
    // Letture vere su immagini ufficiali: rarità e Block attaccati, C al posto di O.
    ['RALIER 2YDL 5SHC ST01-01263', ['ST01-012']],
    ['RAL - 2YDL 5SHC P-001A 1', ['P-001']],
    ['Fish-Man Island CP13-118 SEC 4', ['OP13-118']],
    ['QP05-119', ['OP05-119']],
    // Il trattino a volte sparisce.
    ['OP01001', ['OP01-001']],
    ['ST21017 C', ['ST21-017']],
    // Rumore attorno, a capo, simboli.
    ['| OP07-051 |\nSR ®', ['OP07-051']],
    ['~.,OP13-118 SEC', ['OP13-118']],
    ['©EIICHIRO ODA/SHUEISHA\nOP02-013 L', ['OP02-013']],
  ])('%j → %j', (text, codes) => {
    expect(cardCodesIn(text)).toEqual(codes)
  })

  it('niente Card Code: elenco vuoto', () => {
    expect(cardCodesIn('')).toEqual([])
    expect(cardCodesIn('SR ® 2023')).toEqual([])
    expect(cardCodesIn('XY01-001')).toEqual([])
    expect(cardCodesIn('OP1-001')).toEqual([])
  })

  it('più codici: tutti, una volta sola, nell’ordine letto', () => {
    expect(cardCodesIn('OP01-001 OP01-002\n0P01-001')).toEqual(['OP01-001', 'OP01-002'])
  })
})

describe('recognize', () => {
  const catalog = new Set(['OP01-001', 'OP01-120', 'ST10-001', 'P-001'])

  it('prima i codici che esistono nel catalogo', () => {
    expect(recognize('OP99-999 OP01-120', catalog)).toEqual({
      found: ['OP01-120'],
      unknown: ['OP99-999'],
    })
  })

  it('un codice letto ma non nel catalogo resta da correggere a mano', () => {
    expect(recognize('ST10-011', catalog)).toEqual({ found: [], unknown: ['ST10-011'] })
  })

  it('P-001 letto come P-00l o F-001 no: il prefisso P non si indovina', () => {
    expect(recognize('P-00l', catalog).found).toEqual(['P-001'])
    expect(recognize('F-001', catalog).found).toEqual([])
  })
})
