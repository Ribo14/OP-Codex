// Playtest Table (RIB-99, ADR-0011): lo stato di una partita su un tavolo manuale. L'app applica
// solo la struttura del turno (Refresh, pesca, DON!!); gli effetti delle carte si fanno a mano.
// Codice puro: ogni azione restituisce uno stato nuovo, il caso arriva da `random`.
// Nato nel prototipo di RIB-34 (branch prototype/rib-34), provato dall'utente.

export const DECK_DON = 10
export const HAND_SIZE = 5
export const FIELD_SIZE = 5
/** Potenza in più per ogni DON!! dato a una carta, nel turno del suo proprietario. */
export const DON_POWER = 1000

export type PlayerId = 0 | 1

/** Una carta sul tavolo: sempre la stessa istanza mentre si sposta tra le zone. */
export interface TableCard {
  id: string
  cardCode: string
  printId: string | null
  /** A riposo (ruotata). Conta solo in campo, per il Leader e lo Stage. */
  rested: boolean
  /** DON!! dati a questa carta. */
  don: number
  /** Carta Vita girata a faccia in su. */
  faceUp: boolean
}

/** Le zone in cui il giocatore sposta le carte. */
export type Zone = 'hand' | 'field' | 'stage' | 'trash' | 'life' | 'deckTop' | 'deckBottom'

export interface PlayerSide {
  leader: TableCard
  /** Mazzo: la prima è la carta in cima. */
  deck: TableCard[]
  hand: TableCard[]
  field: TableCard[]
  stage: TableCard | null
  trash: TableCard[]
  /** Vita: la prima è la carta in cima. */
  life: TableCard[]
  donDeck: number
  donActive: number
  donRested: number
  /** Il mulligan si può fare una volta, prima del primo turno. */
  mulliganUsed: boolean
}

export interface Game {
  players: [PlayerSide, PlayerSide]
  /** Di chi è il turno. */
  active: PlayerId
  /** Chi ha iniziato: il suo primo turno non pesca e prende 1 DON!!. */
  first: PlayerId
  /** Turni giocati in tutto (1 = il primo turno di chi inizia). */
  turn: number
  log: string[]
  /** Carta in cima al mazzo mostrata a entrambi (RIB-102), finché qualcuno non la chiude. */
  revealed: { who: PlayerId; id: string } | null
  /** Battaglia in corso (RIB-104, battle.ts). */
  battle: Battle | null
  /** Chi ha vinto, quando la partita è finita. */
  winner: PlayerId | null
}

/** Una battaglia guidata: chi attacca, il bersaglio, a che punto è e la potenza in più. */
export interface Battle {
  attacker: PlayerId
  attackerId: string
  targetId: string
  /** Blocker, poi Counter ("Passa" risolve), poi le Vite col Trigger una alla volta. */
  step: 'block' | 'counter' | 'trigger'
  attackerBonus: number
  defenderBonus: number
  /** Vite ancora da togliere al Leader (due con [Double Attack]). */
  lifeLeft: number
  /** La partita prima dell'attacco, per "Annulla". */
  before: Game
}

/** Il mazzo con cui si siede un giocatore. */
export interface DeckList {
  leader: { cardCode: string; printId: string | null; life: number }
  cards: { cardCode: string; printId: string | null; quantity: number }[]
}

export type Random = () => number

let nextId = 0
function card(cardCode: string, printId: string | null): TableCard {
  nextId += 1
  return { id: `c${String(nextId)}`, cardCode, printId, rested: false, don: 0, faceUp: false }
}

/** Fisher–Yates con il generatore dato. */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const a = out[i] as T
    out[i] = out[j] as T
    out[j] = a
  }
  return out
}

function sitDown(list: DeckList, random: Random): PlayerSide {
  const cards = list.cards.flatMap((c) =>
    Array.from({ length: c.quantity }, () => card(c.cardCode, c.printId)),
  )
  const deck = shuffle(cards, random)
  const hand = deck.splice(0, HAND_SIZE)
  return {
    leader: card(list.leader.cardCode, list.leader.printId),
    deck,
    hand,
    field: [],
    stage: null,
    trash: [],
    life: [],
    donDeck: DECK_DON,
    donActive: 0,
    donRested: 0,
    mulliganUsed: false,
  }
}

/**
 * Inizio partita: mazzi mescolati, 5 carte in mano. Le Vite si mettono dopo il mulligan, con
 * `startGame`.
 */
export function newGame(decks: [DeckList, DeckList], first: PlayerId, random: Random): Game {
  return {
    players: [sitDown(decks[0], random), sitDown(decks[1], random)],
    active: first,
    first,
    turn: 0,
    log: [],
    revealed: null,
    battle: null,
    winner: null,
  }
}

function update(game: Game, who: PlayerId, change: (side: PlayerSide) => PlayerSide): Game {
  const players: [PlayerSide, PlayerSide] = [...game.players]
  players[who] = change(game.players[who])
  return { ...game, players }
}

const withLog = (game: Game, line: string): Game => ({ ...game, log: [...game.log, line] })

/** Mulligan: la mano torna nel mazzo, si rimescola e si pescano 5 carte. Una volta sola. */
export function mulligan(game: Game, who: PlayerId, random: Random): Game {
  if (game.turn > 0 || game.players[who].mulliganUsed) return game
  return update(game, who, (side) => {
    const deck = shuffle([...side.deck, ...side.hand], random)
    const hand = deck.splice(0, HAND_SIZE)
    return { ...side, deck, hand, mulliganUsed: true }
  })
}

/**
 * Si comincia: le Vite (tante quante dice il Leader) dalla cima del mazzo, poi il primo turno di
 * chi inizia: niente pesca e 1 DON!!.
 */
export function startGame(game: Game, lives: [number, number]): Game {
  if (game.turn > 0) return game
  let next = game
  for (const who of [0, 1] as const) {
    next = update(next, who, (side) => {
      const deck = [...side.deck]
      // In cima alla Vita va l'ultima carta messa: si ribalta l'ordine.
      const life = deck.splice(0, lives[who]).reverse()
      return { ...side, deck, life }
    })
  }
  next = update(next, game.first, (side) => addDon(side, 1))
  return withLog({ ...next, turn: 1, active: game.first }, 'Turno 1')
}

function addDon(side: PlayerSide, count: number): PlayerSide {
  const n = Math.min(count, side.donDeck)
  return { ...side, donDeck: side.donDeck - n, donActive: side.donActive + n }
}

const stand = (c: TableCard): TableCard => ({ ...c, rested: false, don: 0 })

/**
 * Nuovo turno dell'altro giocatore: Refresh (tutto attivo, i DON!! dati tornano nell'area dei
 * costi attivi), pesca 1, +2 DON!!.
 */
export function nextTurn(game: Game): Game {
  if (game.turn === 0 || game.battle || game.winner !== null) return game
  const who: PlayerId = game.active === 0 ? 1 : 0
  const next = update(game, who, (side) => {
    const given =
      side.leader.don +
      side.field.reduce((n, c) => n + c.don, 0) +
      (side.stage ? side.stage.don : 0)
    const refreshed: PlayerSide = {
      ...side,
      leader: stand(side.leader),
      field: side.field.map(stand),
      stage: side.stage ? stand(side.stage) : null,
      donActive: side.donActive + side.donRested + given,
      donRested: 0,
    }
    return addDon(drawCards(refreshed, 1), 2)
  })
  return withLog({ ...next, active: who, turn: game.turn + 1 }, `Turno ${String(game.turn + 1)}`)
}

function drawCards(side: PlayerSide, count: number): PlayerSide {
  const deck = [...side.deck]
  const drawn = deck.splice(0, count)
  return { ...side, deck, hand: [...side.hand, ...drawn] }
}

export function draw(game: Game, who: PlayerId, count = 1): Game {
  return update(game, who, (side) => drawCards(side, count))
}

/** Dove si trova una carta del giocatore. */
export function findCard(
  side: PlayerSide,
  id: string,
): { zone: Zone | 'leader'; card: TableCard } | null {
  if (side.leader.id === id) return { zone: 'leader', card: side.leader }
  if (side.stage?.id === id) return { zone: 'stage', card: side.stage }
  for (const zone of ['hand', 'field', 'trash', 'life', 'deck'] as const) {
    const found = side[zone].find((c) => c.id === id)
    if (found) return { zone: zone === 'deck' ? 'deckTop' : zone, card: found }
  }
  return null
}

function without(side: PlayerSide, id: string): PlayerSide {
  return {
    ...side,
    deck: side.deck.filter((c) => c.id !== id),
    hand: side.hand.filter((c) => c.id !== id),
    field: side.field.filter((c) => c.id !== id),
    trash: side.trash.filter((c) => c.id !== id),
    life: side.life.filter((c) => c.id !== id),
    stage: side.stage?.id === id ? null : side.stage,
  }
}

/**
 * Sposta una carta in un'altra zona. Lasciando il campo perde stato e DON!! (i DON!! tornano
 * nell'area dei costi, a riposo); il Leader non si sposta; il campo ha 5 posti.
 */
export function moveCard(game: Game, who: PlayerId, id: string, to: Zone): Game {
  const side = game.players[who]
  const found = findCard(side, id)
  if (!found || found.zone === 'leader' || found.zone === to) return game
  if (to === 'field' && side.field.length >= FIELD_SIZE) return game
  const moved: TableCard = { ...found.card, rested: false, don: 0, faceUp: false }
  return update(game, who, (s) => {
    const rest = { ...without(s, id), donRested: s.donRested + found.card.don }
    switch (to) {
      case 'hand':
        return { ...rest, hand: [...rest.hand, moved] }
      case 'field':
        return { ...rest, field: [...rest.field, moved] }
      case 'stage':
        // Un nuovo Stage manda nel cestino quello vecchio.
        return {
          ...rest,
          stage: moved,
          trash: rest.stage ? [...rest.trash, stand(rest.stage)] : rest.trash,
        }
      case 'trash':
        return { ...rest, trash: [...rest.trash, moved] }
      case 'life':
        return { ...rest, life: [moved, ...rest.life] }
      case 'deckTop':
        return { ...rest, deck: [moved, ...rest.deck] }
      case 'deckBottom':
        return { ...rest, deck: [...rest.deck, moved] }
    }
  })
}

function mapCard(side: PlayerSide, id: string, change: (c: TableCard) => TableCard): PlayerSide {
  return {
    ...side,
    leader: side.leader.id === id ? change(side.leader) : side.leader,
    stage: side.stage?.id === id ? change(side.stage) : side.stage,
    field: side.field.map((c) => (c.id === id ? change(c) : c)),
    life: side.life.map((c) => (c.id === id ? change(c) : c)),
  }
}

/** Riposa o rimette attiva una carta (Leader, campo, Stage). */
export function toggleRest(game: Game, who: PlayerId, id: string): Game {
  return update(game, who, (side) => mapCard(side, id, (c) => ({ ...c, rested: !c.rested })))
}

/** Dà un DON!! attivo dell'area dei costi alla carta. */
export function giveDon(game: Game, who: PlayerId, id: string): Game {
  if (game.players[who].donActive === 0) return game
  return update(game, who, (side) => ({
    ...mapCard(side, id, (c) => ({ ...c, don: c.don + 1 })),
    donActive: side.donActive - 1,
  }))
}

/** Toglie un DON!! dalla carta: torna nell'area dei costi, a riposo. */
export function takeDon(game: Game, who: PlayerId, id: string): Game {
  const found = findCard(game.players[who], id)
  if (!found || found.card.don === 0) return game
  return update(game, who, (side) => ({
    ...mapCard(side, id, (c) => ({ ...c, don: c.don - 1 })),
    donRested: side.donRested + 1,
  }))
}

export type DonAction = 'rest' | 'activate' | 'add' | 'return'

/** Area dei costi: riposa 1 (paga), attiva 1, +1 dal mazzo DON!!, DON!! −1 (torna nel mazzo). */
export function changeDon(game: Game, who: PlayerId, action: DonAction): Game {
  return update(game, who, (side) => {
    switch (action) {
      case 'rest':
        return side.donActive > 0
          ? { ...side, donActive: side.donActive - 1, donRested: side.donRested + 1 }
          : side
      case 'activate':
        return side.donRested > 0
          ? { ...side, donActive: side.donActive + 1, donRested: side.donRested - 1 }
          : side
      case 'add':
        return addDon(side, 1)
      case 'return':
        if (side.donRested > 0)
          return { ...side, donRested: side.donRested - 1, donDeck: side.donDeck + 1 }
        if (side.donActive > 0)
          return { ...side, donActive: side.donActive - 1, donDeck: side.donDeck + 1 }
        return side
    }
  })
}

/** Gira una carta Vita a faccia in su o in giù. */
export function flipLife(game: Game, who: PlayerId, id: string): Game {
  return update(game, who, (side) => mapCard(side, id, (c) => ({ ...c, faceUp: !c.faceUp })))
}

/** Rimescola il mazzo. */
export function shuffleDeck(game: Game, who: PlayerId, random: Random): Game {
  return update(game, who, (side) => ({ ...side, deck: shuffle(side.deck, random) }))
}

// ---- Guardare e cercare nel mazzo (RIB-102) ----

/** Dove va una carta guardata dalla cima del mazzo. */
export type LookDestination = 'hand' | 'field' | 'trash' | 'deckTop' | 'deckBottom'

/**
 * Sistema le carte guardate in cima al mazzo. L'ordine del piano conta: tra quelle rimesse in
 * cima, la prima del piano torna la prima del mazzo; tra quelle in fondo, la prima del piano
 * resta la più in alto. Oltre i 5 posti del campo una carta va in mano invece che in campo.
 */
export function resolveLook(
  game: Game,
  who: PlayerId,
  plan: readonly { id: string; to: LookDestination }[],
): Game {
  const side = game.players[who]
  const ids = new Set(plan.map((p) => p.id))
  const byId = new Map(side.deck.filter((c) => ids.has(c.id)).map((c) => [c.id, c]))
  if (byId.size !== plan.length) return game
  const rest = side.deck.filter((c) => !ids.has(c.id))
  const pick = (to: LookDestination) =>
    plan.flatMap((p) => {
      const c = byId.get(p.id)
      return p.to === to && c ? [c] : []
    })
  const free = FIELD_SIZE - side.field.length
  const toField = pick('field')
  return update(game, who, (s) => ({
    ...s,
    deck: [...pick('deckTop'), ...rest, ...pick('deckBottom')],
    hand: [...s.hand, ...pick('hand'), ...toField.slice(free)],
    field: [...s.field, ...toField.slice(0, free)],
    trash: [...s.trash, ...pick('trash')],
  }))
}

/** Prende una carta qualsiasi dal mazzo (in mano o in campo) e, se richiesto, rimescola. */
export function takeFromDeck(
  game: Game,
  who: PlayerId,
  id: string,
  to: 'hand' | 'field',
  random: Random | null,
): Game {
  if (!game.players[who].deck.some((c) => c.id === id)) return game
  const moved = moveCard(game, who, id, to)
  return random && moved !== game ? shuffleDeck(moved, who, random) : moved
}

/** Mostra a entrambi la carta in cima al mazzo; resta nel mazzo. */
export function revealTop(game: Game, who: PlayerId): Game {
  const top = game.players[who].deck[0]
  return top ? { ...game, revealed: { who, id: top.id } } : game
}

export function hideRevealed(game: Game): Game {
  return game.revealed ? { ...game, revealed: null } : game
}

/**
 * Potenza mostrata sotto una carta: quella stampata più 1000 per ogni DON!! dato, ma solo nel
 * turno del proprietario. Null per le carte senza potenza (Stage).
 */
export function cardPower(
  game: Game,
  who: PlayerId,
  card: TableCard,
  printed: number | null,
): number | null {
  if (printed === null) return null
  return printed + (game.active === who ? card.don * DON_POWER : 0)
}

/** DON!! in gioco: quelli attivi e tutti quelli sul tavolo (anche a riposo o dati alle carte). */
export function donInPlay(side: PlayerSide): { active: number; total: number } {
  const given = side.leader.don + side.field.reduce((n, c) => n + c.don, 0) + (side.stage?.don ?? 0)
  return { active: side.donActive, total: side.donActive + side.donRested + given }
}
