import { BookOpen, Layers, LibraryBig, User, WalletCards, type LucideIcon } from 'lucide-react'

export interface Section {
  key: 'catalog' | 'decks' | 'collection' | 'rules' | 'profile'
  path: string
  icon: LucideIcon
  /** false = la sezione mostra "in arrivo". */
  ready: boolean
  /** true = serve l'account: senza accesso la voce non compare nella navigazione. */
  account: boolean
}

/** Le sezioni principali, nell'ordine della navigazione. */
export const SECTIONS: readonly Section[] = [
  { key: 'catalog', path: '/', icon: LibraryBig, ready: true, account: false },
  { key: 'decks', path: '/mazzi', icon: Layers, ready: true, account: true },
  { key: 'collection', path: '/collezione', icon: WalletCards, ready: true, account: true },
  { key: 'rules', path: '/regole', icon: BookOpen, ready: false, account: false },
  { key: 'profile', path: '/profilo', icon: User, ready: true, account: true },
]

/**
 * Le voci della navigazione: senza accesso solo quelle che non richiedono l'account, così la
 * barra resta leggera (al posto del Profilo, sul telefono, compare "Accedi").
 */
export function navSections(signedIn: boolean): readonly Section[] {
  return signedIn ? SECTIONS : SECTIONS.filter((section) => !section.account)
}

export const PRIVACY_PATH = '/privacy'
/** Fuori dalla barra delle sezioni: ingranaggio nell'intestazione e nella barra laterale. */
export const SETTINGS_PATH = '/impostazioni'
/** Area Admin (RIB-19): fuori dalla navigazione, voce nelle Impostazioni solo per gli Admin. */
export const ADMIN_PATH = '/admin'
