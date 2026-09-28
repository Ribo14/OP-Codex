import {
  BookOpen,
  Layers,
  LibraryBig,
  ScanLine,
  User,
  Users,
  WalletCards,
  type LucideIcon,
} from 'lucide-react'
import { PROFILE_PATH } from '@/account/paths'
import { FRIENDS_PATH } from '@/friends/paths'
import { SCANNER_PATH } from '@/scanner/paths'

export interface Section {
  key: 'catalog' | 'scanner' | 'decks' | 'collection' | 'friends' | 'rules' | 'profile'
  path: string
  icon: LucideIcon
  /** false = la sezione mostra "in arrivo". */
  ready: boolean
  /** true = serve l'account: senza accesso la voce non compare nella navigazione. */
  account: boolean
}

/** Le sezioni principali, nell'ordine della barra laterale (desktop). */
export const SECTIONS: readonly Section[] = [
  { key: 'catalog', path: '/', icon: LibraryBig, ready: true, account: false },
  { key: 'scanner', path: SCANNER_PATH, icon: ScanLine, ready: true, account: false },
  { key: 'decks', path: '/mazzi', icon: Layers, ready: true, account: true },
  { key: 'collection', path: '/collezione', icon: WalletCards, ready: true, account: true },
  // Amici (RIB-71): sul telefono si raggiungono dal Profilo, non dalla barra in basso.
  { key: 'friends', path: FRIENDS_PATH, icon: Users, ready: true, account: true },
  { key: 'rules', path: '/regole', icon: BookOpen, ready: true, account: false },
  { key: 'profile', path: PROFILE_PATH, icon: User, ready: true, account: true },
]

/**
 * Le voci della navigazione: senza accesso solo quelle che non richiedono l'account, così la
 * barra resta leggera (al posto del Profilo, sul telefono, compare "Accedi").
 */
export function navSections(signedIn: boolean): readonly Section[] {
  return signedIn ? SECTIONS : SECTIONS.filter((section) => !section.account)
}

/** Ordine della barra in basso del telefono (RIB-69): lo Scanner al centro. */
const PHONE_ORDER: readonly Section['key'][] = [
  'catalog',
  'decks',
  'scanner',
  'collection',
  'rules',
]

/**
 * Le voci della barra in basso del telefono: lo Scanner al centro e il Profilo fuori, perché
 * sta nell'intestazione (RIB-69). Senza accesso: Catalogo, Scanner, Regole (e poi "Accedi").
 */
export function phoneSections(signedIn: boolean): readonly Section[] {
  const available = navSections(signedIn)
  return PHONE_ORDER.flatMap((key) => available.filter((section) => section.key === key))
}

export const PRIVACY_PATH = '/privacy'
/** Fuori dalla barra delle sezioni: ingranaggio nell'intestazione e nella barra laterale. */
export const SETTINGS_PATH = '/impostazioni'
/** Area Admin (RIB-19): fuori dalla navigazione, voce nelle Impostazioni solo per gli Admin. */
export const ADMIN_PATH = '/admin'
