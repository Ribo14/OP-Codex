import { describe, expect, it } from 'vitest'
import { DEFAULT_RETURN, loginPath, safeReturnPath } from './return-path'

describe('ritorno dopo l’accesso', () => {
  it('accetta i percorsi interni, con la loro query', () => {
    expect(safeReturnPath('/collezione')).toBe('/collezione')
    expect(safeReturnPath('/carta/OP01-001?stampa=OP01-001_p1')).toBe(
      '/carta/OP01-001?stampa=OP01-001_p1',
    )
  })

  it('rifiuta indirizzi esterni o strani e ripiega sul profilo', () => {
    for (const bad of [
      null,
      '',
      'https://evil.example',
      '//evil.example',
      '/\\evil.example',
      'profilo',
    ]) {
      expect(safeReturnPath(bad), String(bad)).toBe(DEFAULT_RETURN)
    }
  })

  it('costruisce il link all’accesso con il ritorno', () => {
    expect(loginPath('/profilo?x=1')).toBe('/accesso?torna=%2Fprofilo%3Fx%3D1')
  })
})
