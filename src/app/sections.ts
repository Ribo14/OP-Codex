import { BookOpen, Layers, LibraryBig, User, WalletCards, type LucideIcon } from 'lucide-react'

export interface Section {
  key: 'catalog' | 'decks' | 'collection' | 'rules' | 'profile'
  path: string
  icon: LucideIcon
  /** false = la sezione mostra "in arrivo". */
  ready: boolean
}

/** Le sezioni principali, nell'ordine della navigazione. */
export const SECTIONS: readonly Section[] = [
  { key: 'catalog', path: '/', icon: LibraryBig, ready: true },
  { key: 'decks', path: '/mazzi', icon: Layers, ready: false },
  { key: 'collection', path: '/collezione', icon: WalletCards, ready: false },
  { key: 'rules', path: '/regole', icon: BookOpen, ready: false },
  { key: 'profile', path: '/profilo', icon: User, ready: false },
]

export const PRIVACY_PATH = '/privacy'
/** Fuori dalla barra delle sezioni: ingranaggio nell'intestazione e nella barra laterale. */
export const SETTINGS_PATH = '/impostazioni'
