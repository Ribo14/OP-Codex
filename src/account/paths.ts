// Indirizzi delle pagine di account (RIB-14, RIB-17).
export const LOGIN_PATH = '/accesso'
export const SIGNUP_PATH = '/registrazione'
export const RECOVER_PATH = '/recupero-password'
/** Arrivo dai link delle email; deve coincidere con i template in supabase/templates. */
export const CONFIRM_PATH = '/account/conferma'
export const NEW_PASSWORD_PATH = '/account/nuova-password'
/** Ritorno da Google dopo "Continua con Google". */
export const OAUTH_CALLBACK_PATH = '/account/google'
/** Codice della verifica in due passaggi, dopo password o Google (RIB-18). */
export const CODE_PATH = '/account/codice'
export const PROFILE_PATH = '/profilo'

/** Pagine del percorso di accesso: lì non si mostra "Accedi" e non si interrompe l'utente. */
export const ACCOUNT_PATHS: readonly string[] = [
  LOGIN_PATH,
  SIGNUP_PATH,
  RECOVER_PATH,
  CONFIRM_PATH,
  NEW_PASSWORD_PATH,
  OAUTH_CALLBACK_PATH,
  CODE_PATH,
]
