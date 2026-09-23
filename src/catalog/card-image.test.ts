import { describe, expect, it } from 'vitest'
import { cardImageUrl } from './card-image'

const SUPABASE = 'https://abc.supabase.co'

describe('cardImageUrl', () => {
  it('punta alla miniatura su Supabase Storage per default', () => {
    expect(cardImageUrl('OP01-001', undefined, SUPABASE)).toBe(
      'https://abc.supabase.co/storage/v1/object/public/card-images/thumb/OP01-001.webp',
    )
  })

  it('punta all’immagine completa quando richiesta, anche per varianti e ristampe', () => {
    expect(cardImageUrl('OP01-001_p1', 'full', SUPABASE)).toBe(
      'https://abc.supabase.co/storage/v1/object/public/card-images/full/OP01-001_p1.webp',
    )
    expect(cardImageUrl('P-014_r1', 'thumb', `${SUPABASE}/`)).toBe(
      'https://abc.supabase.co/storage/v1/object/public/card-images/thumb/P-014_r1.webp',
    )
  })

  it('rifiuta tutto ciò che non è un Print ID', () => {
    for (const bad of [
      '',
      '../secret',
      'OP01-001.png',
      'OP01-001?x=1',
      'op01-001',
      'OP01-001_x1',
    ]) {
      expect(() => cardImageUrl(bad, 'thumb', SUPABASE)).toThrow('Print ID non valido')
    }
  })

  it('segnala la configurazione mancante', () => {
    expect(() => cardImageUrl('OP01-001', 'thumb', '')).toThrow('VITE_SUPABASE_URL mancante')
  })
})
