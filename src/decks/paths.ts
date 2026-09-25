// Indirizzi dei Mazzi (RIB-21).
export const DECKS_PATH = '/mazzi'
export const NEW_DECK_PATH = '/mazzi/nuovo'
export const IMPORT_DECK_PATH = '/mazzi/importa'

export const deckPath = (deckId: string) => `${DECKS_PATH}/${deckId}`

/** Share Link di un Deck (RIB-26): corto, per WhatsApp. */
export const SHARED_DECK_PATH = '/m/:token'
export const sharedDeckPath = (token: string) => `/m/${token}`
export const sharedDeckUrl = (token: string) => `${window.location.origin}${sharedDeckPath(token)}`
export const deckLeaderPath = (deckId: string) => `${DECKS_PATH}/${deckId}/leader`
