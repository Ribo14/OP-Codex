// Indirizzi dei Mazzi (RIB-21).
export const DECKS_PATH = '/mazzi'
export const NEW_DECK_PATH = '/mazzi/nuovo'

export const deckPath = (deckId: string) => `${DECKS_PATH}/${deckId}`
export const deckLeaderPath = (deckId: string) => `${DECKS_PATH}/${deckId}/leader`
