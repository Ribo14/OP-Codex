// Playtest Table (RIB-99): /tavolo, con ?mazzo=<id> per preselezionare un Deck dell'utente.
export const PLAYTEST_PATH = '/tavolo'
export const PLAYTEST_DECK_PARAM = 'mazzo'

export const playtestPath = (deckId?: string) =>
  deckId
    ? `${PLAYTEST_PATH}?${new URLSearchParams({ [PLAYTEST_DECK_PARAM]: deckId }).toString()}`
    : PLAYTEST_PATH
