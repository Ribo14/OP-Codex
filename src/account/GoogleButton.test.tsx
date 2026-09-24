import { act, fireEvent, render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import it_ from '@/i18n/it.json'
import { GoogleButton } from './GoogleButton'
import { OAuthCallbackPage } from './OAuthCallbackPage'

const signInWithOAuth = vi.fn<(options: unknown) => Promise<{ error: null }>>(() =>
  Promise.resolve({ error: null }),
)

vi.mock('@/lib/supabase', () => ({
  getSupabase: () => ({ auth: { signInWithOAuth } }),
}))
vi.mock('./session', () => ({ useSession: () => ({ status: 'signedOut' }) }))

describe('Continua con Google', () => {
  it('va da Google e al ritorno passa dalla pagina di callback con la pagina di partenza', async () => {
    render(<GoogleButton returnTo="/collezione?x=1" />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: it_.account.google.continue }))
      await Promise.resolve()
    })
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/account/google?torna=%2Fcollezione%3Fx%3D1`,
        queryParams: { prompt: 'select_account' },
      },
    })
  })

  it('se Google o Supabase segnalano un errore lo dice e offre di riprovare', () => {
    const router = createMemoryRouter(
      [{ path: '/account/google', element: <OAuthCallbackPage /> }],
      { initialEntries: ['/account/google?error=access_denied&torna=%2Fprofilo'] },
    )
    render(<RouterProvider router={router} />)
    expect(screen.getByText(it_.account.google.failed)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: it_.account.confirm.toLogin })).toHaveAttribute(
      'href',
      '/accesso?torna=%2Fprofilo',
    )
  })
})
