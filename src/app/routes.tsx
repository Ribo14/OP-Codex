import type { RouteObject } from 'react-router'
import { CatalogPage } from '@/catalog/CatalogPage'
import { AppShell } from './AppShell'
import { ComingSoonPage, NotFoundPage, PrivacyPage } from './pages'
import { PRIVACY_PATH, SECTIONS } from './sections'

/** Tutte le pagine dell'app, dentro la shell. Condivise tra app e test. */
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <CatalogPage /> },
      ...SECTIONS.filter((s) => !s.ready).map((s) => ({
        path: s.path,
        element: <ComingSoonPage section={s.key} />,
      })),
      { path: PRIVACY_PATH, element: <PrivacyPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
