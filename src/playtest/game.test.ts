import { describe, expect, it } from 'vitest'
import {
  cardPower,
  changeDon,
  DECK_DON,
  donInPlay,
  hideRevealed,
  resolveLook,
  revealTop,
  takeFromDeck,
  giveDon,
  moveCard,
  mulligan,
  newGame,
  nextTurn,
  startGame,
  takeDon,
  toggleRest,
  type DeckList,
  type Random,
} from './game'

// Generatore deterministico per i test.
function seeded(seed = 1): Random {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const deck = (prefix: string): DeckList => ({
  leader: { cardCode: `${prefix}-001`, printId: null, life: 5 },
  cards: Array.from({ length: 12 }, (_, i) => ({
    cardCode: `${prefix}-${String(i + 2).padStart(3, '0')}`,
    printId: null,
    quantity: i < 2 ? 5 : 4,
  })),
})

const setup = () => newGame([deck('ST01'), deck('ST02')], 0, seeded())

describe('Playtest Table: inizio partita', () => {
  it('mazzo da 50 mescolato, 5 carte in mano, 10 DON!! nel mazzo DON!!', () => {
    const game = setup()
    const me = game.players[0]
    expect(me.hand).toHaveLength(5)
    expect(me.deck).toHaveLength(45)
    expect(me.donDeck).toBe(DECK_DON)
    expect(me.leader.cardCode).toBe('ST01-001')
  })

  it('mulligan una volta sola, prima di cominciare', () => {
    const game = setup()
    const after = mulligan(game, 0, seeded(7))
    expect(after.players[0].hand).toHaveLength(5)
    expect(after.players[0].deck).toHaveLength(45)
    expect(after.players[0].mulliganUsed).toBe(true)
    expect(mulligan(after, 0, seeded(9))).toBe(after)
  })

  it('le Vite dalla cima del mazzo; chi inizia non pesca e prende 1 DON!!', () => {
    const game = startGame(setup(), [5, 4])
    expect(game.turn).toBe(1)
    expect(game.players[0].life).toHaveLength(5)
    expect(game.players[1].life).toHaveLength(4)
    expect(game.players[0].deck).toHaveLength(40)
    expect(game.players[0].hand).toHaveLength(5)
    expect(game.players[0].donActive).toBe(1)
    expect(game.players[1].donActive).toBe(0)
  })
})

describe('Playtest Table: turno', () => {
  it('nuovo turno: Refresh, pesca 1, +2 DON!! al giocatore di turno', () => {
    let game = startGame(setup(), [5, 5])
    game = nextTurn(game)
    expect(game.active).toBe(1)
    expect(game.turn).toBe(2)
    expect(game.players[1].hand).toHaveLength(6)
    expect(game.players[1].donActive).toBe(2)
    expect(game.players[1].donDeck).toBe(8)
  })

  it('il Refresh rimette tutto attivo e riporta i DON!! dati nell’area dei costi', () => {
    let game = startGame(setup(), [5, 5])
    const me = game.players[0]
    const played = me.hand[0]?.id ?? ''
    game = moveCard(game, 0, played, 'field')
    game = giveDon(game, 0, played)
    game = toggleRest(game, 0, played)
    game = toggleRest(game, 0, me.leader.id)
    expect(game.players[0].donActive).toBe(0)
    game = nextTurn(nextTurn(game))
    const side = game.players[0]
    expect(side.field[0]).toMatchObject({ rested: false, don: 0 })
    expect(side.leader.rested).toBe(false)
    // 1 (tornato dalla carta) + 2 del nuovo turno.
    expect(side.donActive).toBe(3)
  })
})

describe('Playtest Table: carte e DON!!', () => {
  it('spostare una carta: campo al massimo 5, il Leader non si muove', () => {
    let game = startGame(setup(), [5, 5])
    for (const c of game.players[0].hand) game = moveCard(game, 0, c.id, 'field')
    const extra = game.players[0].deck[0]?.id ?? ''
    game = moveCard(game, 0, extra, 'hand')
    game = moveCard(game, 0, extra, 'field')
    expect(game.players[0].field).toHaveLength(5)
    expect(game.players[0].hand.map((c) => c.id)).toContain(extra)
    expect(moveCard(game, 0, game.players[0].leader.id, 'trash')).toBe(game)
  })

  it('una carta K.O. va nel cestino e i suoi DON!! tornano a riposo', () => {
    let game = startGame(setup(), [5, 5])
    const id = game.players[0].hand[0]?.id ?? ''
    game = moveCard(game, 0, id, 'field')
    game = giveDon(game, 0, id)
    game = moveCard(game, 0, id, 'trash')
    expect(game.players[0].trash.at(-1)).toMatchObject({ id, don: 0 })
    expect(game.players[0].donRested).toBe(1)
  })

  it('un nuovo Stage manda nel cestino quello vecchio', () => {
    let game = startGame(setup(), [5, 5])
    const [a, b] = game.players[0].hand
    game = moveCard(game, 0, a?.id ?? '', 'stage')
    game = moveCard(game, 0, b?.id ?? '', 'stage')
    expect(game.players[0].stage?.id).toBe(b?.id)
    expect(game.players[0].trash.map((c) => c.id)).toEqual([a?.id])
  })

  it('area dei costi: riposa, attiva, aggiungi, DON!! −1', () => {
    let game = startGame(setup(), [5, 5])
    game = changeDon(game, 0, 'add')
    game = changeDon(game, 0, 'rest')
    expect(game.players[0]).toMatchObject({ donActive: 1, donRested: 1, donDeck: 8 })
    game = changeDon(game, 0, 'return')
    expect(game.players[0]).toMatchObject({ donActive: 1, donRested: 0, donDeck: 9 })
    game = changeDon(game, 0, 'activate')
    expect(game.players[0].donActive).toBe(1)
  })

  it('togliere un DON!! da una carta lo rimette a riposo', () => {
    let game = startGame(setup(), [5, 5])
    const leader = game.players[0].leader.id
    game = giveDon(game, 0, leader)
    game = takeDon(game, 0, leader)
    expect(game.players[0]).toMatchObject({ donActive: 0, donRested: 1 })
    expect(game.players[0].leader.don).toBe(0)
  })
})

describe('Playtest Table: potenza e contatore DON!!', () => {
  it('+1000 per DON!! solo nel turno del proprietario', () => {
    let game = startGame(setup(), [5, 5])
    const leader = game.players[0].leader.id
    game = giveDon(game, 0, leader)
    const card = game.players[0].leader
    expect(cardPower(game, 0, card, 5000)).toBe(6000)
    game = { ...game, active: 1 }
    expect(cardPower(game, 0, card, 5000)).toBe(5000)
    expect(cardPower(game, 0, card, null)).toBeNull()
  })

  it('attivi / totali contano anche i DON!! a riposo e quelli dati alle carte', () => {
    let game = startGame(setup(), [5, 5])
    game = nextTurn(nextTurn(game))
    // Giocatore 0 al suo secondo turno: 1 + 2 DON!!.
    game = giveDon(game, 0, game.players[0].leader.id)
    game = changeDon(game, 0, 'rest')
    expect(donInPlay(game.players[0])).toEqual({ active: 1, total: 3 })
  })
})

describe('Playtest Table: guardare e cercare nel mazzo', () => {
  it('guarda le prime 3: una in mano, una in fondo, una in cima nell\u2019ordine scelto', () => {
    const game = startGame(setup(), [5, 5])
    const before = game.players[0]
    const [a, b, c] = before.deck
    if (!a || !b || !c) throw new Error('mazzo corto')
    const next = resolveLook(game, 0, [
      { id: c.id, to: 'deckTop' },
      { id: a.id, to: 'hand' },
      { id: b.id, to: 'deckBottom' },
    ])
    const side = next.players[0]
    expect(side.deck[0]?.id).toBe(c.id)
    expect(side.deck.at(-1)?.id).toBe(b.id)
    expect(side.hand.at(-1)?.id).toBe(a.id)
    expect(side.deck).toHaveLength(before.deck.length - 1)
  })

  it('oltre i 5 posti del campo la carta va in mano; un piano con carte non del mazzo non fa nulla', () => {
    let game = startGame(setup(), [5, 5])
    for (const card of game.players[0].hand.slice(0, 5)) game = moveCard(game, 0, card.id, 'field')
    const top = game.players[0].deck[0]
    if (!top) throw new Error('mazzo vuoto')
    const next = resolveLook(game, 0, [{ id: top.id, to: 'field' }])
    expect(next.players[0].field).toHaveLength(5)
    expect(next.players[0].hand.at(-1)?.id).toBe(top.id)
    expect(resolveLook(game, 0, [{ id: 'nessuna', to: 'hand' }])).toBe(game)
  })

  it('cercare una carta nel mazzo: in mano, poi rimescolato se richiesto', () => {
    const game = startGame(setup(), [5, 5])
    const wanted = game.players[0].deck[20]
    if (!wanted) throw new Error('mazzo corto')
    const kept = takeFromDeck(game, 0, wanted.id, 'hand', null)
    expect(kept.players[0].hand.at(-1)?.id).toBe(wanted.id)
    expect(kept.players[0].deck.map((c) => c.id)).toEqual(
      game.players[0].deck.filter((c) => c.id !== wanted.id).map((c) => c.id),
    )
    const shuffled = takeFromDeck(game, 0, wanted.id, 'field', seeded(7))
    expect(shuffled.players[0].field.map((c) => c.id)).toEqual([wanted.id])
    expect(shuffled.players[0].deck.map((c) => c.id)).not.toEqual(
      kept.players[0].deck.map((c) => c.id),
    )
  })

  it('rivelare la carta in cima la mostra senza toglierla dal mazzo', () => {
    const game = startGame(setup(), [5, 5])
    const shown = revealTop(game, 1)
    expect(shown.revealed).toEqual({ who: 1, id: game.players[1].deck[0]?.id })
    expect(shown.players[1].deck).toEqual(game.players[1].deck)
    expect(hideRevealed(shown).revealed).toBeNull()
  })
})
