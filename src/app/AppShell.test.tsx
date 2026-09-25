import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import '@/i18n'
import it_ from '@/i18n/it.json'
import { routes } from './routes'
import { navSections, SECTIONS } from './sections'
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

describe('navigazione con e senza account', () => {
  it('con l’accesso compaiono tutte le sezioni', () => {
    expect(navSections(true)).toEqual(SECTIONS)
  })

  it('senza accesso restano solo le sezioni consultabili senza account', () => {
    expect(navSections(false).map((s) => s.key)).toEqual(['catalog', 'rules'])
  })
})

describe('App shell', () => {
  it('senza account la barra del telefono ha Catalogo, Regole e Accedi; il desktop le sezioni', async () => {
    renderAt('/')
    const navs = screen.getAllByRole('navigation', { name: it_.nav.label })
    expect(navs).toHaveLength(2)
    const [desktop, phone] = navs
    if (!desktop || !phone) throw new Error('navigazione mancante')
    const labels = (nav: HTMLElement) =>
      within(nav)
        .getAllByRole('link')
        .map((a) => a.textContent)
    await waitFor(() => {
      expect(labels(phone)).toEqual([it_.nav.catalog, it_.nav.rules, it_.nav.login])
    })
    expect(labels(desktop)).toEqual([it_.nav.catalog, it_.nav.rules])
  })

  it('le Impostazioni si aprono dall’ingranaggio (telefono) e dalla barra laterale', async () => {
    const router = renderAt('/')
    const links = screen.getAllByRole('link', { name: it_.settings.title })
    expect(links).toHaveLength(2)
    const [gear] = links
    if (!gear) throw new Error('ingranaggio mancante')

    await act(async () => {
      fireEvent.click(gear)
      await Promise.resolve()
    })
    expect(router.state.location.pathname).toBe('/impostazioni')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(it_.settings.title)
    expect(
      screen.getByRole('heading', { level: 2, name: it_.settings.images.title }),
    ).toBeInTheDocument()
    for (const link of screen.getAllByRole('link', { name: it_.settings.title })) {
      expect(link).toHaveAttribute('aria-current', 'page')
    }
  })

  it('senza account "Accedi" porta all’accesso e poi riporta alla pagina di partenza', async () => {
    renderAt('/?colore=Red')
    // Barra laterale (desktop) e barra in basso (telefono); nessun doppione nell'intestazione.
    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: it_.nav.login })).toHaveLength(2)
    })
    for (const link of screen.getAllByRole('link', { name: it_.nav.login })) {
      expect(link).toHaveAttribute('href', '/accesso?torna=%2F%3Fcolore%3DRed')
    }
  })

  it('nelle pagine di account "Accedi" è la voce attiva della barra, senza ritorno', async () => {
    renderAt('/registrazione')
    await screen.findByRole('heading', { level: 1, name: it_.account.signup.title })
    // La voce della barra e il link della pagina ("Hai già un account? Accedi").
    const links = screen.getAllByRole('link', { name: it_.nav.login })
    expect(links.map((link) => link.getAttribute('href'))).toEqual(['/accesso', '/accesso'])
    expect(links[1]).toHaveAttribute('aria-current', 'page')
  })

  it('le sezioni non ancora pronte mostrano "in arrivo"', () => {
    renderAt('/regole')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Regole: in arrivo')
  })

  it('si naviga tra le sezioni e la voce attiva è segnalata', async () => {
    const router = renderAt('/')
    const [nav] = screen.getAllByRole('navigation', { name: it_.nav.label })
    if (!nav) throw new Error('navigazione mancante')

    await act(async () => {
      fireEvent.click(within(nav).getByRole('link', { name: it_.nav.rules }))
      await Promise.resolve()
    })

    expect(router.state.location.pathname).toBe('/regole')
    expect(within(nav).getByRole('link', { name: it_.nav.rules })).toHaveAttribute(
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
