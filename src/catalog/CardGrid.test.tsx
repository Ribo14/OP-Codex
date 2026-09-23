import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CardGrid } from './CardGrid'

describe('CardGrid', () => {
  it('mostra ogni Card con l’immagine della sua Printing', () => {
    render(
      <CardGrid
        printings={[
          { printId: 'OP01-001', cardCode: 'OP01-001', name: 'Roronoa Zoro' },
          { printId: 'OP01-006_p3', cardCode: 'OP01-006', name: 'Otama' },
        ]}
      />,
    )

    const images = screen.getAllByRole('img')
    expect(images.map((img) => img.getAttribute('src'))).toEqual([
      '/card-images/OP01-001.png',
      '/card-images/OP01-006_p3.png',
    ])
    expect(screen.getByAltText('Otama')).toBeInTheDocument()
    expect(screen.getByText('OP01-001 · Roronoa Zoro')).toBeInTheDocument()
  })
})
