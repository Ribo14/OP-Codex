import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import it_ from '@/i18n/it.json'
import { InstallInvite } from './InstallInvite'

function renderInvite(context: 'android' | 'ios-safari' | 'ios-other') {
  const onInstall = vi.fn()
  const onDismiss = vi.fn()
  render(<InstallInvite context={context} onInstall={onInstall} onDismiss={onDismiss} />)
  return { onInstall, onDismiss }
}

describe('InstallInvite', () => {
  it('Android: pulsante Installa', () => {
    const { onInstall } = renderInvite('android')
    fireEvent.click(screen.getByRole('button', { name: it_.install.installButton }))
    expect(onInstall).toHaveBeenCalledOnce()
  })

  it('iPhone in Safari: guida in tre passi, senza pulsante Installa', () => {
    renderInvite('ios-safari')
    expect(screen.getByText(it_.install.iosStep1)).toBeInTheDocument()
    expect(screen.getByText(it_.install.iosStep2)).toBeInTheDocument()
    expect(screen.getByText(it_.install.iosStep3)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: it_.install.installButton })).toBeNull()
  })

  it('iPhone in un altro browser: spiega di aprire con Safari', () => {
    renderInvite('ios-other')
    expect(screen.getByText(it_.install.iosOther)).toBeInTheDocument()
  })

  it('"Non ora" e la X chiudono l’invito', () => {
    const { onDismiss } = renderInvite('ios-safari')
    fireEvent.click(screen.getByRole('button', { name: it_.install.dismiss }))
    fireEvent.click(screen.getByRole('button', { name: it_.install.close }))
    expect(onDismiss).toHaveBeenCalledTimes(2)
  })
})
