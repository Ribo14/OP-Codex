import type { Game, PlayerSide, TableCard } from './game'
import type { TableDeck } from './table-decks'

// La partita non si perde chiudendo l'app (RIB-103): una sola partita in corso, salvata sul
// dispositivo a ogni mossa. All'uscita dall'account si cancella con gli altri dati personali
// (contiene le liste dei Deck).

export const SAVED_GAME_KEY = 'op-codex-playtest'
const VERSION = 1

export interface SavedGame {
  version: typeof VERSION
  game: Game
  decks: [TableDeck, TableDeck]
  savedAt: string
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null
const isCard = (x: unknown): x is TableCard =>
  isObject(x) && typeof x.id === 'string' && typeof x.cardCode === 'string'
const isCards = (x: unknown): x is TableCard[] => Array.isArray(x) && x.every(isCard)
const isNumber = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

function isSide(x: unknown): x is PlayerSide {
  return (
    isObject(x) &&
    isCard(x.leader) &&
    isCards(x.deck) &&
    isCards(x.hand) &&
    isCards(x.field) &&
    isCards(x.trash) &&
    isCards(x.life) &&
    (x.stage === null || isCard(x.stage)) &&
    isNumber(x.donDeck) &&
    isNumber(x.donActive) &&
    isNumber(x.donRested)
  )
}

const isDeck = (x: unknown): x is TableDeck =>
  isObject(x) &&
  typeof x.id === 'string' &&
  typeof x.name === 'string' &&
  isObject(x.list) &&
  isObject(x.list.leader) &&
  Array.isArray(x.list.cards)

/** La partita salvata se è leggibile e della versione giusta; altrimenti null. */
export function parseSavedGame(raw: string | null): SavedGame | null {
  if (!raw) return null
  try {
    const data: unknown = JSON.parse(raw)
    if (!isObject(data) || data.version !== VERSION) return null
    const { game, decks } = data
    if (
      !isObject(game) ||
      !Array.isArray(game.players) ||
      game.players.length !== 2 ||
      !game.players.every(isSide) ||
      !isNumber(game.turn) ||
      !Array.isArray(decks) ||
      decks.length !== 2 ||
      !decks.every(isDeck)
    ) {
      return null
    }
    const revealed = isObject(game.revealed) ? game.revealed : null
    return {
      ...(data as unknown as SavedGame),
      game: { ...(game as unknown as Game), revealed } as Game,
    }
  } catch {
    return null
  }
}

export function loadSavedGame(): SavedGame | null {
  try {
    return parseSavedGame(localStorage.getItem(SAVED_GAME_KEY))
  } catch {
    return null
  }
}

export function saveGame(game: Game, decks: [TableDeck, TableDeck]): void {
  const saved: SavedGame = { version: VERSION, game, decks, savedAt: new Date().toISOString() }
  try {
    localStorage.setItem(SAVED_GAME_KEY, JSON.stringify(saved))
  } catch {
    /* spazio pieno o storage bloccato: la partita resta solo in memoria */
  }
}

export function clearSavedGame(): void {
  try {
    localStorage.removeItem(SAVED_GAME_KEY)
  } catch {
    /* niente da cancellare */
  }
}
