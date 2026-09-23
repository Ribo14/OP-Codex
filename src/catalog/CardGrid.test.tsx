import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CardGrid } from './CardGrid'

beforeEach(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://abc.supabase.co')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('CardGrid', () => {
  it('mostra ogni Card con la miniatura della sua Printing da Supabase Storage', () => {
    render(
      <CardGrid
        printings={[
          { printId: 'OP01-001', cardCode: 'OP01-001', name: 'Roronoa Zoro', hasImage: true },
          { printId: 'OP01-006_p3', cardCode: 'OP01-006', name: 'Otama', hasImage: true },
        ]}
      />,
    )

    const images = screen.getAllByRole('img')
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      'https://abc.supabase.co/storage/v1/object/public/card-images/thumb/OP01-001.webp',
      'https://abc.supabase.co/storage/v1/object/public/card-images/thumb/OP01-006_p3.webp',
    ])
    expect(screen.getByAltText('Otama')).toBeInTheDocument()
    expect(screen.getByText('Roronoa Zoro')).toBeInTheDocument()
    expect(screen.getByText('OP01-001')).toBeInTheDocument()
  })

  it('mostra un segnaposto per le Printing senza immagine', () => {
    render(
      <CardGrid
        printings={[{ printId: 'OP01-002', cardCode: 'OP01-002', name: 'Law', hasImage: false }]}
      />,
    )

    expect(
      screen.getByRole('img', { name: 'Law: immagine non ancora disponibile' }),
    ).not.toHaveAttribute('src')
  })
})
