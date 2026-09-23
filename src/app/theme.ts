import { createContext, useCallback, useContext, useEffect, useState } from 'react'

// Tema: segue il sistema finché l'utente non ne sceglie uno; la scelta resta sul dispositivo.
// public/theme-init.js applica lo stesso tema prima del primo disegno (niente lampo di tema sbagliato):
// chiave e valori devono restare allineati a quel file.

export type ThemePreference = 'system' | 'light' | 'dark'

export const THEME_STORAGE_KEY = 'op-codex-theme'
export const THEME_ORDER: readonly ThemePreference[] = ['system', 'light', 'dark']

export function isDark(preference: ThemePreference, systemPrefersDark: boolean): boolean {
  return preference === 'dark' || (preference === 'system' && systemPrefersDark)
}

export function nextPreference(current: ThemePreference): ThemePreference {
  const index = THEME_ORDER.indexOf(current)
  return THEME_ORDER[(index + 1) % THEME_ORDER.length] ?? 'system'
}

export function readPreference(storage: Pick<Storage, 'getItem'> | undefined): ThemePreference {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : 'system'
  } catch {
    return 'system' // storage bloccato (navigazione privata, dati cancellati…)
  }
}

export function writePreference(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | undefined,
  preference: ThemePreference,
): void {
  try {
    if (preference === 'system') storage?.removeItem(THEME_STORAGE_KEY)
    else storage?.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    /* la scelta vale solo per questa sessione */
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

export interface ThemeState {
  preference: ThemePreference
  choose: (preference: ThemePreference) => void
}

/** Un solo stato del tema per tutta l'app (vedi ThemeProvider). */
export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme(): ThemeState {
  const state = useContext(ThemeContext)
  if (!state) throw new Error('useTheme va usato dentro ThemeProvider')
  return state
}

/** Preferenza corrente, con aggiornamento automatico se cambia il tema del sistema. */
export function useThemeState(): ThemeState {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    readPreference(safeLocalStorage()),
  )

  useEffect(() => {
    const query = darkQuery()
    const apply = () => {
      document.documentElement.classList.toggle('dark', isDark(preference, query.matches))
    }
    apply()
    query.addEventListener('change', apply)
    return () => {
      query.removeEventListener('change', apply)
    }
  }, [preference])

  const choose = useCallback((next: ThemePreference) => {
    writePreference(safeLocalStorage(), next)
    setPreference(next)
  }, [])

  return { preference, choose }
}
