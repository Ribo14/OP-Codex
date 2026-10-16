import { afterEach, describe, expect, it } from 'vitest'
import { newGame, startGame, type DeckList } from './game'
import {
  clearSavedGame,
  loadSavedGame,
  parseSavedGame,
  SAVED_GAME_KEY,
  saveGame,
} from './saved-game'
import type { TableDeck } from './table-decks'

// Partita salvata sul dispositivo (RIB-103).

const list = (prefix: string): DeckList => ({
  leader: { cardCode: `${prefix}-001`, printId: null, life: 5 },
  cards: Array.from({ length: 10 }, (_, i) => ({
    cardCode: `${prefix}-${String(i + 2).padStart(3, '0')}`,
    printId: null,
    quantity: 5,
  })),
})
const deck = (prefix: string): TableDeck => ({
  id: prefix,
  name: prefix,
  kind: 'starter',
  list: list(prefix),
})
const decks: [TableDeck, TableDeck] = [deck('ST01'), deck('ST02')]
const game = () =>
  startGame(
    newGame([decks[0].list, decks[1].list], 0, () => 0.42),
    [5, 5],
  )

describe('partita salvata', () => {
  afterEach(() => {
    localStorage.clear()
  })

  it('si salva e si rilegge identica', () => {
    const g = game()
    saveGame(g, decks)
    const saved = loadSavedGame()
    expect(saved?.game).toEqual(g)
    expect(saved?.decks).toEqual(decks)
  })

  it('dati rovinati, di un’altra versione o di forma sbagliata: nessuna partita', () => {
    expect(parseSavedGame(null)).toBeNull()
    expect(parseSavedGame('{non json')).toBeNull()
    expect(parseSavedGame(JSON.stringify({ version: 2, game: game(), decks }))).toBeNull()
    const broken = { version: 1, game: { ...game(), players: [] }, decks }
    expect(parseSavedGame(JSON.stringify(broken))).toBeNull()
  })

  it('"Nuova partita" la cancella', () => {
    saveGame(game(), decks)
    clearSavedGame()
    expect(localStorage.getItem(SAVED_GAME_KEY)).toBeNull()
    expect(loadSavedGame()).toBeNull()
  })
})
