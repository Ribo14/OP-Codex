import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import it_ from '@/i18n/it.json'
import type { Catalog, CatalogCard } from './catalog-data'
import { CardDetailRoute } from './CardDetailRoute'
import { CatalogPage } from './CatalogPage'

const card = (
  partial: Partial<CatalogCard> & Pick<CatalogCard, 'cardCode' | 'name'>,
): CatalogCard => ({
  category: 'Character',
  cost: 1,
  life: null,
  power: 2000,
  counter: 1000,
  colors: ['Red'],
  attributes: ['Special'],
  types: ['Straw Hat Crew'],
  block: '1',
  effect: null,
  trigger: null,
  keywords: [],
  printings: [{ printId: partial.cardCode, rarity: 'C', setCode: 'OP-01', hasImage: false }],
  ...partial,
})

const CATALOG: Catalog = {
  sets: [
    { seriesId: 569101, code: 'OP-01', name: 'ROMANCE DAWN' },
    { seriesId: 569301, code: 'PRB-01', name: 'ONE PIECE CARD THE BEST' },
  ],
  cards: [
    card({
      cardCode: 'OP01-016',
      name: 'Nami',
      effect: '[On Play] Look at 5 cards from the top of your deck.',
      keywords: ['On Play'],
      printings: [
        { printId: 'OP01-016', rarity: 'R', setCode: 'OP-01', hasImage: false },
        { printId: 'OP01-016_p1', rarity: 'R', setCode: 'OP-01', hasImage: false },
        { printId: 'OP01-016_p8', rarity: 'SP CARD', setCode: 'PRB-01', hasImage: false },
      ],
    }),
    card({
      cardCode: 'ZZ99-001',
      name: 'Carta di prova',
      effect: '<script>alert(1)</script><b>grassetto</b> & <img src=x onerror=alert(2)>',
    }),
  ],
}

vi.mock('./local-catalog', () => ({
  OFFLINE: 'offline',
  useCatalog: () => ({
    catalog: CATALOG,
    checkedAt: Date.UTC(2026, 8, 23, 8, 0),
    syncing: false,
    error: null,
    retry: () => Promise.resolve(),
  }),
}))

async function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <CatalogPage />,
        children: [{ index: true }, { path: 'carta/:cardCode', element: <CardDetailRoute /> }],
      },
    ],
    { initialEntries: [path] },
  )
  const view = render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { level: 1, name: it_.catalog.title })
  return { router, container: view.container }
}

const printingRadios = () => within(screen.getByRole('radiogroup', { name: it_.detail.printings }))

describe('Dettaglio Card', () => {
  it('un URL diretto con il Card Code apre la carta con la Printing base', async () => {
    await renderAt('/carta/OP01-016')
    expect(screen.getByRole('heading', { level: 2, name: 'Nami' })).toBeInTheDocument()
    expect(printingRadios().getByRole('radio', { name: /^OP01-016 ·/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  it('con il Print ID nell’URL apre la Printing giusta, anche con il codice in minuscolo', async () => {
    await renderAt('/carta/op01-016?stampa=OP01-016_p8')
    expect(printingRadios().getByRole('radio', { name: /^OP01-016_p8 ·/ })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByText('OP01-016_p8 · PRB-01 · SP CARD')).toBeInTheDocument()
  })

  it('cambiare Printing aggiorna rarità, Set e URL senza ricaricare', async () => {
    const { router } = await renderAt('/carta/OP01-016')
    const heading = screen.getByRole('heading', { level: 2, name: 'Nami' })

    await act(async () => {
      fireEvent.click(printingRadios().getByRole('radio', { name: /^OP01-016_p8 ·/ }))
      await Promise.resolve()
    })

    expect(router.state.location.search).toBe('?stampa=OP01-016_p8')
    expect(screen.getByText('OP01-016_p8 · PRB-01 · SP CARD')).toBeInTheDocument()
    // Stessa pagina, stesso elemento: nessun ricaricamento.
    expect(screen.getByRole('heading', { level: 2, name: 'Nami' })).toBe(heading)
  })

  it('scorrendo l’immagine col dito si passa alla Printing successiva e alla precedente', async () => {
    const { router } = await renderAt('/carta/OP01-016')
    const image = within(screen.getByRole('complementary', { name: 'Nami' })).getByRole('img', {
      name: it_.catalog.imagePending.replace('{{name}}', 'Nami'),
    })
    const swipe = async (fromX: number, toX: number, toY = 300) => {
      await act(async () => {
        fireEvent.touchStart(image, { touches: [{ clientX: fromX, clientY: 300 }] })
        fireEvent.touchMove(image, { touches: [{ clientX: toX, clientY: toY }] })
        fireEvent.touchEnd(image, { changedTouches: [{ clientX: toX, clientY: toY }] })
        await Promise.resolve()
      })
    }

    await swipe(300, 150) // verso sinistra: successiva
    expect(router.state.location.search).toBe('?stampa=OP01-016_p1')
    await swipe(300, 150)
    expect(router.state.location.search).toBe('?stampa=OP01-016_p8')
    await swipe(300, 150) // già all'ultima: resta lì
    expect(router.state.location.search).toBe('?stampa=OP01-016_p8')
    await swipe(150, 300) // verso destra: precedente
    expect(router.state.location.search).toBe('?stampa=OP01-016_p1')
    await swipe(300, 280) // movimento troppo corto: niente
    expect(router.state.location.search).toBe('?stampa=OP01-016_p1')
    await swipe(300, 200, 600) // gesto verticale (scorrimento della pagina): niente
    expect(router.state.location.search).toBe('?stampa=OP01-016_p1')
  })

  it('mostra i Set in cui compare ogni Printing', async () => {
    await renderAt('/carta/OP01-016')
    const table = screen.getByRole('table')
    expect(within(table).getByText('ONE PIECE CARD THE BEST')).toBeInTheDocument()
    expect(within(table).getAllByText('ROMANCE DAWN')).toHaveLength(2)
  })

  it('un effetto con caratteri HTML viene mostrato come testo, mai come HTML', async () => {
    const { container } = await renderAt('/carta/ZZ99-001')
    expect(
      screen.getByText('<script>alert(1)</script><b>grassetto</b> & <img src=x onerror=alert(2)>'),
    ).toBeInTheDocument()
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(container.querySelector('img[src="x"]')).toBeNull()
  })

  it('un Card Code inesistente lo dice', async () => {
    await renderAt('/carta/XX00-000')
    expect(screen.getByRole('heading', { name: it_.detail.notFound })).toBeInTheDocument()
  })

  it('dal catalogo si apre il dettaglio e chiudendolo i filtri restano', async () => {
    const { router } = await renderAt('/?colore=Red')
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: /Nami/ }))
      await Promise.resolve()
    })
    expect(router.state.location.pathname).toBe('/carta/OP01-016')
    expect(router.state.location.search).toBe('?colore=Red')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: it_.detail.close }))
      await Promise.resolve()
    })
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.search).toBe('?colore=Red')
  })

  it('aprendo un’altra carta col dettaglio già aperto, chiudere torna ai risultati', async () => {
    const { router } = await renderAt('/?colore=Red')
    const open = async (name: RegExp) => {
      await act(async () => {
        fireEvent.click(screen.getByRole('link', { name }))
        await Promise.resolve()
      })
    }
    await open(/Nami/)
    await open(/Carta di prova/)
    await open(/Nami/)
    expect(router.state.location.pathname).toBe('/carta/OP01-016')

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: it_.detail.close }))
      await Promise.resolve()
    })
    expect(router.state.location.pathname).toBe('/')
    expect(router.state.location.search).toBe('?colore=Red')
  })

  it('da un link diretto, aprendo un’altra carta e chiudendo si arriva ai risultati', async () => {
    const { router } = await renderAt('/carta/OP01-016')
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: /Carta di prova/ }))
      await Promise.resolve()
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: it_.detail.close }))
      await Promise.resolve()
    })
    expect(router.state.location.pathname).toBe('/')
  })

  it('Esc chiude il dettaglio', async () => {
    const { router } = await renderAt('/carta/OP01-016')
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
      await Promise.resolve()
    })
    expect(router.state.location.pathname).toBe('/')
  })
})
