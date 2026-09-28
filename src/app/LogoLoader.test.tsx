import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LogoLoader } from './LogoLoader'

// RIB-38: il logo animato del caricamento compare solo se l'attesa supera 200 ms.

describe('LogoLoader', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('il testo c’è subito per i lettori di schermo, il logo si anima dopo 200 ms', () => {
    const { container } = render(<LogoLoader label="Caricamento del catalogo…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Caricamento del catalogo…')
    const logo = container.querySelector('img')
    expect(logo).toHaveClass('opacity-0')

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(logo).toHaveClass('animate-logo-sway', 'motion-reduce:animate-none')
    expect(screen.getByText('Caricamento del catalogo…')).not.toHaveClass('sr-only')
  })
})
