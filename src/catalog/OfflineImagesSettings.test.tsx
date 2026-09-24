import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import it_ from '@/i18n/it.json'
import type { Catalog } from './catalog-data'
import { OfflineImagesSettings } from './OfflineImagesSettings'

const CATALOG: Catalog = {
  sets: [{ seriesId: 1, code: 'OP-01', name: 'ROMANCE DAWN' }],
  cards: [
    {
      cardCode: 'OP01-001',
      name: 'Roronoa Zoro',
      category: 'Leader',
      cost: null,
      life: 5,
      power: 5000,
      counter: null,
      colors: ['Red'],
      attributes: [],
      types: [],
      block: '1',
      effect: null,
      trigger: null,
      keywords: [],
      printings: [
        { printId: 'OP01-001', rarity: 'L', setCode: 'OP-01', hasImage: true },
        { printId: 'OP01-001_p1', rarity: 'L', setCode: 'OP-01', hasImage: true },
        { printId: 'OP01-001_p2', rarity: 'L', setCode: 'OP-01', hasImage: false },
      ],
    },
  ],
}

vi.mock('./local-catalog', () => ({
  useCatalog: () => ({ catalog: CATALOG }),
}))

describe('Impostazioni → immagini offline', () => {
  it('dice quante immagini mancano, quanto pesano e propone di scaricarle', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    render(<OfflineImagesSettings />)
    // jsdom non ha le cache del service worker: nessuna immagine sul dispositivo.
    expect(await screen.findByText('Sul dispositivo: 0 immagini su 4')).toBeInTheDocument()
    expect(screen.getByText(/^Mancano 4 immagini, circa 1\s?MB\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: it_.settings.images.downloadAll })).toBeEnabled()
    // Niente da eliminare finché non c'è nulla sul dispositivo.
    expect(screen.queryByRole('button', { name: it_.settings.images.clear })).toBeNull()
    vi.unstubAllEnvs()
  })
})
