import type { ReactNode } from 'react'
import { ThemeContext, useThemeState } from './theme'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const state = useThemeState()
  return <ThemeContext value={state}>{children}</ThemeContext>
}
