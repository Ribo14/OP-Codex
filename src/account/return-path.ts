import { CODE_PATH, LOGIN_PATH, PROFILE_PATH } from './paths'

// Dove tornare dopo l'accesso (?torna=...). Solo percorsi interni all'app: un indirizzo esterno
// ("https://…", "//sito") trasformerebbe il login in un rimando verso siti di terzi.

export const RETURN_PARAM = 'torna'
export const DEFAULT_RETURN = PROFILE_PATH

export function safeReturnPath(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
    return DEFAULT_RETURN
  }
  return value
}

export function loginPath(returnTo: string): string {
  return `${LOGIN_PATH}?${new URLSearchParams({ [RETURN_PARAM]: returnTo }).toString()}`
}

/** Pagina del codice della verifica in due passaggi, poi di nuovo `returnTo`. */
export function codePath(returnTo: string): string {
  return `${CODE_PATH}?${new URLSearchParams({ [RETURN_PARAM]: returnTo }).toString()}`
}
