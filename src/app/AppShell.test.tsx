import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import '@/i18n'
import it_ from '@/i18n/it.json'
import { routes } from './routes'
import { SECTIONS } from './sections'
import { THEME_STORAGE_KEY } from './theme'
import { ThemeProvider } from './ThemeProvider'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  )
  return router
}

afterEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

const PATHS = ['/', '/mazzi', '/collezione', '/regole', '/profilo', '/privacy', '/non-esiste']

describe('App shell', () => {
  it('ha una navigazione per telefono e una per desktop con tutte le sezioni', () => {
    renderAt('/')
    const navs = screen.getAllByRole('navigation', { name: it_.nav.label })
    expect(navs).toHaveLength(2)
    for (const nav of navs) {
      const labels = within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent)
      expect(labels).toEqual(SECTIONS.map((s) => it_.nav[s.key]))
    }
  })

  it('le sezioni non ancora pronte mostrano "in arrivo"', () => {
    renderAt('/mazzi')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Mazzi: in arrivo')
  })

  it('si naviga tra le sezioni e la voce attiva è segnalata', async () => {
    const router = renderAt('/')
    const [nav] = screen.getAllByRole('navigation', { name: it_.nav.label })
    if (!nav) throw new Error('navigazione mancante')

    await act(async () => {
      fireEvent.click(within(nav).getByRole('link', { name: it_.nav.collection }))
      await Promise.resolve()
    })

    expect(router.state.location.pathname).toBe('/collezione')
    expect(within(nav).getByRole('link', { name: it_.nav.collection })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('nel dettaglio di una carta la voce Catalogo resta attiva', () => {
    renderAt('/carta/OP01-001')
    for (const nav of screen.getAllByRole('navigation', { name: it_.nav.label })) {
      expect(within(nav).getByRole('link', { name: it_.nav.catalog })).toHaveAttribute(
        'aria-current',
        'page',
      )
    }
  })

  it('un indirizzo sconosciuto mostra la pagina non trovata', () => {
    renderAt('/non-esiste')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(it_.notFound.title)
  })

  it.each(PATHS)('su %s sono raggiungibili l’avviso Bandai e la privacy', (path) => {
    renderAt(path)
    expect(screen.getAllByText(it_.footer.disclaimer).length).toBeGreaterThan(0)
    const privacyLinks = screen.getAllByRole('link', { name: it_.footer.privacy })
    expect(privacyLinks[0]).toHaveAttribute('href', '/privacy')
  })

  it('su desktop non compare nessun invito automatico all’installazione', () => {
    renderAt('/')
    expect(screen.queryByRole('complementary', { name: it_.install.title })).toBeNull()
  })

  it('c’è un link per saltare al contenuto', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: it_.app.skipToContent })).toHaveAttribute(
      'href',
      '#contenuto',
    )
  })

  it('la privacy policy si apre dal link', () => {
    renderAt('/privacy')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(it_.privacy.title)
  })

  it('il tema scelto si applica subito e si ricorda', () => {
    renderAt('/')
    const group = screen.getByRole('radiogroup', { name: it_.theme.label })

    fireEvent.click(within(group).getByRole('radio', { name: it_.theme.dark }))
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    // Anche il pulsante del telefono vede lo stesso tema.
    expect(screen.getByRole('button', { name: /Tema: Scuro/ })).toBeInTheDocument()

    fireEvent.click(within(group).getByRole('radio', { name: it_.theme.light }))
    expect(document.documentElement).not.toHaveClass('dark')
  })
})
