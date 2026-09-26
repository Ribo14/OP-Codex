import type { RouteObject } from 'react-router'
import { CodePage } from '@/account/CodePage'
import { ConfirmPage } from '@/account/ConfirmPage'
import { LoginPage } from '@/account/LoginPage'
import { NewPasswordPage } from '@/account/NewPasswordPage'
import { OAuthCallbackPage } from '@/account/OAuthCallbackPage'
import {
  CODE_PATH,
  CONFIRM_PATH,
  LOGIN_PATH,
  NEW_PASSWORD_PATH,
  OAUTH_CALLBACK_PATH,
  PROFILE_PATH,
  RECOVER_PATH,
  SIGNUP_PATH,
} from '@/account/paths'
import { ProfilePage } from '@/account/ProfilePage'
import { RecoverPage } from '@/account/RecoverPage'
import { SignupPage } from '@/account/SignupPage'
import { AdminPage } from '@/admin/AdminPage'
import { CollectionPage } from '@/collection/CollectionPage'
import { DeckEditorPage } from '@/decks/DeckEditorPage'
import { DecksPage } from '@/decks/DecksPage'
import { LeaderPickerPage } from '@/decks/LeaderPickerPage'
import { ImportDeckPage } from '@/decks/ImportDeckPage'
import { DECKS_PATH, IMPORT_DECK_PATH, NEW_DECK_PATH, SHARED_DECK_PATH } from '@/decks/paths'
import { RULES_PATH } from '@/rules/paths'
import { RulesPage } from '@/rules/RulesPage'
import { SharedDeckPage } from '@/decks/SharedDeckPage'
import { CardDetailRoute } from '@/catalog/CardDetailRoute'
import { CatalogPage } from '@/catalog/CatalogPage'
import { AppShell } from './AppShell'
import { ComingSoonPage, NotFoundPage, PrivacyPage } from './pages'
import { ADMIN_PATH, PRIVACY_PATH, SECTIONS, SETTINGS_PATH } from './sections'
import { SettingsPage } from './SettingsPage'

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
      { path: '/collezione', element: <CollectionPage /> },
      // Regole: glossario (RIB-51)
      { path: RULES_PATH, element: <RulesPage /> },
      // Mazzi (RIB-21)
      { path: DECKS_PATH, element: <DecksPage /> },
      { path: NEW_DECK_PATH, element: <LeaderPickerPage /> },
      { path: IMPORT_DECK_PATH, element: <ImportDeckPage /> },
      // Share Link (RIB-26): pubblico, anche senza account
      { path: SHARED_DECK_PATH, element: <SharedDeckPage /> },
      { path: `${DECKS_PATH}/:deckId`, element: <DeckEditorPage /> },
      { path: `${DECKS_PATH}/:deckId/leader`, element: <LeaderPickerPage /> },
      { path: PRIVACY_PATH, element: <PrivacyPage /> },
      { path: SETTINGS_PATH, element: <SettingsPage /> },
      // Account (RIB-14)
      { path: PROFILE_PATH, element: <ProfilePage /> },
      { path: LOGIN_PATH, element: <LoginPage /> },
      { path: SIGNUP_PATH, element: <SignupPage /> },
      { path: RECOVER_PATH, element: <RecoverPage /> },
      { path: CONFIRM_PATH, element: <ConfirmPage /> },
      { path: NEW_PASSWORD_PATH, element: <NewPasswordPage /> },
      { path: OAUTH_CALLBACK_PATH, element: <OAuthCallbackPage /> },
      { path: CODE_PATH, element: <CodePage /> },
      { path: ADMIN_PATH, element: <AdminPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
