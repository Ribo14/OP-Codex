import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import it_ from '@/i18n/it.json'
import type { Catalog, CatalogCard } from './catalog-data'
import { CatalogPage } from './CatalogPage'

const card = (
  partial: Partial<CatalogCard> & Pick<CatalogCard, 'cardCode' | 'name'>,
): CatalogCard => ({
  category: 'Character',
  cost: 1,
  life: null,
  power: 1000,
  counter: null,
  colors: ['Red'],
  attributes: ['Strike'],
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
    { seriesId: 569102, code: 'OP-02', name: 'PARAMOUNT WAR' },
  ],
  cards: [
    card({
      cardCode: 'OP01-016',
      name: 'Nami',
      keywords: ['On Play'],
      printings: [
        { printId: 'OP01-016', rarity: 'R', setCode: 'OP-01', hasImage: false },
        { printId: 'OP01-016_p1', rarity: 'R', setCode: 'OP-01', hasImage: false },
      ],
    }),
    card({
      cardCode: 'ST01-012',
      name: 'Monkey.D.Luffy',
      keywords: ['Rush'],
      cost: 5,
      printings: [
        { printId: 'ST01-012', rarity: 'SR', setCode: 'ST-01', hasImage: false },
        { printId: 'ST01-012_p1', rarity: 'SR', setCode: 'ST-01', hasImage: true },
      ],
    }),
    card({
      cardCode: 'OP02-008',
      name: 'Jozu',
      colors: ['Green'],
      keywords: ['Blocker'],
      effect: '[Blocker]\n[On K.O.] Draw 1 card and trash 1 card from your hand.',
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
  const router = createMemoryRouter([{ path: '/', element: <CatalogPage /> }], {
    initialEntries: [path],
  })
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { level: 1, name: it_.catalog.title })
  return router
}

const desktopFilters = () => screen.getByRole('complementary', { name: it_.catalog.filters })
const names = () =>
  screen
    .getAllByRole('listitem')
    .map((li) => li.textContent)
    .filter(Boolean)

describe('Catalogo', () => {
  it('mostra tutte le carte con il conteggio', async () => {
    await renderAt('/')
    expect(screen.getByText('3 carte')).toBeInTheDocument()
  })

  it('la ricerca filtra e finisce nell’URL', async () => {
    const router = await renderAt('/')
    await act(async () => {
      fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'jozu' } })
      await Promise.resolve()
    })
    expect(router.state.location.search).toBe('?q=jozu')
    expect(await screen.findByText('1 carta')).toBeInTheDocument()
  })

  it('una Keyword dal pannello filtra e si riflette nell’URL', async () => {
    const router = await renderAt('/')
    await act(async () => {
      fireEvent.click(within(desktopFilters()).getByRole('button', { name: 'Rush' }))
      await Promise.resolve()
    })
    expect(router.state.location.search).toBe('?keyword=Rush')
    expect(await screen.findByText('1 carta')).toBeInTheDocument()
    expect(within(desktopFilters()).getByRole('button', { name: 'Rush' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('aprire un link con filtri ripristina la stessa ricerca', async () => {
    await renderAt('/?colore=Green&effetto=trash')
    expect(await screen.findByText('1 carta')).toBeInTheDocument()
    expect(names().some((n) => n.includes('Jozu'))).toBe(true)
    expect(within(desktopFilters()).getByRole('button', { name: /Verde/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('l’interruttore delle Printing mostra anche le varianti', async () => {
    await renderAt('/?q=nami')
    expect(await screen.findByText('1 carta')).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(
        within(desktopFilters()).getByRole('checkbox', { name: it_.filters.allPrintings }),
      )
      await Promise.resolve()
    })
    expect(await screen.findByText('2 carte')).toBeInTheDocument()
  })

  it('"Azzera filtri" torna al catalogo completo', async () => {
    const router = await renderAt('/?colore=Green&q=jozu')
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: it_.catalog.reset }))
      await Promise.resolve()
    })
    expect(router.state.location.search).toBe('')
    expect(await screen.findByText('3 carte')).toBeInTheDocument()
  })

  it('su telefono i filtri si aprono in un pannello con il numero di risultati', async () => {
    await renderAt('/?colore=Red')
    fireEvent.click(screen.getByRole('button', { name: 'Filtri (1)' }))
    const dialog = screen.getByRole('dialog', { name: it_.catalog.filters })
    expect(within(dialog).getByRole('button', { name: 'Mostra 2 carte' })).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mostra 2 carte' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('senza risultati lo dice', async () => {
    await renderAt('/?q=nessunacarta')
    expect(await screen.findByText(it_.catalog.noResults)).toBeInTheDocument()
  })

  it('dice quanto sono recenti i dati sul dispositivo', async () => {
    await renderAt('/')
    expect(screen.getByText(/^Dati aggiornati al /)).toBeInTheDocument()
  })

  it('con un solo Set filtrato propone di scaricarne le immagini', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    const fetcher = vi.fn(() => Promise.resolve(new Response('img')))
    vi.stubGlobal('fetch', fetcher)
    try {
      await renderAt('/?set=ST-01')
      fireEvent.click(screen.getByRole('button', { name: it_.offline.setDownload }))
      expect(
        await screen.findByText(
          'Immagini di ST-01 salvate sul dispositivo: disponibili anche offline.',
        ),
      ).toBeInTheDocument()
      // Miniatura e immagine grande dell'unica Printing di ST-01 con immagine.
      expect(fetcher).toHaveBeenCalledTimes(2)
    } finally {
      vi.unstubAllGlobals()
      vi.unstubAllEnvs()
    }
  })

  it('senza filtro di Set, o con più Set, niente download', async () => {
    await renderAt('/?set=OP-01,ST-01')
    expect(screen.queryByRole('button', { name: it_.offline.setDownload })).not.toBeInTheDocument()
  })
})
