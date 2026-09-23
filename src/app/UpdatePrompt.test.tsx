import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import it_ from '@/i18n/it.json'
import { UpdatePrompt } from './UpdatePrompt'

const sw = vi.hoisted(() => ({
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(() => Promise.resolve()),
}))

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({
    needRefresh: [sw.needRefresh, sw.setNeedRefresh],
    offlineReady: [false, vi.fn()],
    updateServiceWorker: sw.updateServiceWorker,
  }),
}))

beforeEach(() => {
  sw.setNeedRefresh.mockClear()
  sw.updateServiceWorker.mockClear()
})

describe('UpdatePrompt', () => {
  it('senza nuove versioni non mostra niente', () => {
    sw.needRefresh = false
    render(<UpdatePrompt />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('con una nuova versione propone di aggiornare', () => {
    sw.needRefresh = true
    render(<UpdatePrompt />)
    expect(screen.getByRole('status')).toHaveTextContent(it_.update.available)

    fireEvent.click(screen.getByRole('button', { name: it_.update.reload }))
    expect(sw.updateServiceWorker).toHaveBeenCalledWith(true)
  })

  it('"Più tardi" nasconde l’avviso', () => {
    sw.needRefresh = true
    render(<UpdatePrompt />)
    fireEvent.click(screen.getByRole('button', { name: it_.update.later }))
    expect(sw.setNeedRefresh).toHaveBeenCalledWith(false)
  })
})
