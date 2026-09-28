import { describe, expect, it } from 'vitest'
import { createConfirmer } from './scan-confirm'

// Lettura continua (RIB-68): una carta si propone solo quando lo stesso Card Code del catalogo
// arriva in due letture di fila, così un errore isolato dell'OCR non apre la carta sbagliata.

describe('createConfirmer', () => {
  it('conferma al secondo arrivo di fila dello stesso codice', () => {
    const { push } = createConfirmer()
    expect(push(['OP01-001'])).toBeNull()
    expect(push(['OP01-001'])).toBe('OP01-001')
  })

  it('una lettura diversa o vuota in mezzo fa ripartire il conteggio', () => {
    const { push } = createConfirmer()
    expect(push(['OP01-001'])).toBeNull()
    expect(push(['OP01-002'])).toBeNull()
    expect(push(['OP01-001'])).toBeNull()
    expect(push([])).toBeNull()
    expect(push(['OP01-001'])).toBeNull()
    expect(push(['OP01-001'])).toBe('OP01-001')
  })

  it('conta il primo codice trovato nella lettura', () => {
    const { push } = createConfirmer()
    expect(push(['ST01-012', 'OP01-001'])).toBeNull()
    expect(push(['ST01-012'])).toBe('ST01-012')
  })

  it('dopo una conferma serve di nuovo una coppia di letture', () => {
    const { push } = createConfirmer()
    push(['OP01-001'])
    expect(push(['OP01-001'])).toBe('OP01-001')
    expect(push(['OP01-001'])).toBeNull()
    expect(push(['OP01-001'])).toBe('OP01-001')
  })

  it('un codice bloccato si ignora finché la carta resta inquadrata', () => {
    const { push, block } = createConfirmer()
    block('OP01-001')
    expect(push(['OP01-001'])).toBeNull()
    expect(push(['OP01-001'])).toBeNull()
    expect(push(['OP01-001'])).toBeNull()
    // Un'altra carta nel frattempo si legge normalmente.
    expect(push(['OP01-001', 'ST01-012'])).toBeNull()
    expect(push(['OP01-001', 'ST01-012'])).toBe('ST01-012')
  })

  it('tolta la carta dall’inquadratura, il blocco sparisce', () => {
    const { push, block } = createConfirmer()
    block('OP01-001')
    expect(push(['OP01-001'])).toBeNull()
    expect(push([])).toBeNull()
    expect(push(['OP01-001'])).toBeNull()
    expect(push(['OP01-001'])).toBe('OP01-001')
  })

  it('le letture richieste si possono cambiare', () => {
    const { push } = createConfirmer(1)
    expect(push(['OP01-001'])).toBe('OP01-001')
  })
})
