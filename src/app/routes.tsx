import type { RouteObject } from 'react-router'
import { CardDetailRoute } from '@/catalog/CardDetailRoute'
import { CatalogPage } from '@/catalog/CatalogPage'
import { AppShell } from './AppShell'
import { ComingSoonPage, NotFoundPage, PrivacyPage } from './pages'
import { PRIVACY_PATH, SECTIONS } from './sections'

/** Tutte le pagine dell'app, dentro la shell. Condivise tra app e test. */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      {
        // Il dettaglio di una Card vive dentro il catalogo: su desktop è un pannello accanto
        // ai risultati (ricerca e filtri restano), su telefono va a tutto schermo.
        path: '/',
        element: <CatalogPage />,
        children: [{ index: true }, { path: 'carta/:cardCode', element: <CardDetailRoute /> }],
      },
      ...SECTIONS.filter((s) => !s.ready).map((s) => ({
        path: s.path,
        element: <ComingSoonPage section={s.key} />,
      })),
      { path: PRIVACY_PATH, element: <PrivacyPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
