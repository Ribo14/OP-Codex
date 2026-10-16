import { describe, expect, it } from 'vitest'
import {
  addBonus,
  answerTrigger,
  attackTargets,
  battlePowers,
  block,
  canAttack,
  cancelBattle,
  resolveBattle,
  skipBlock,
  startAttack,
  playCounter,
  type CardFacts,
  type Facts,
} from './battle'
import { giveDon, moveCard, newGame, nextTurn, startGame, toggleRest, type Game } from './game'

// Attacco guidato (RIB-104).

function seeded(seed = 1) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

// Carte di prova: A = Leader 5000; B..F Personaggi con poteri e parole chiave diverse.
const FACTS: Record<string, Partial<CardFacts>> = {
  'AA-001': { power: 5000 },
  'AA-002': { power: 3000, counter: 1000 },
  'AA-003': { power: 6000, counter: 2000, blocker: true },
  'AA-004': { power: 4000, doubleAttack: true },
  'AA-005': { power: 2000, trigger: true },
}
const facts: Facts = (code) => ({
  power: null,
  counter: null,
  blocker: false,
  doubleAttack: false,
  trigger: false,
  ...FACTS[code],
})

const deck = {
  leader: { cardCode: 'AA-001', printId: null, life: 2 },
  cards: ['AA-002', 'AA-003', 'AA-004', 'AA-005'].map((cardCode) => ({
    cardCode,
    printId: null,
    quantity: 12,
  })),
}

/** Turno 2 (tocca al giocatore 1, che può attaccare); ognuno con una carta per codice in mano. */
function setup(): Game {
  let game = startGame(newGame([deck, deck], 0, seeded(3)), [2, 2])
  game = nextTurn(game)
  return game
}

/** Prende dal mazzo una carta col codice dato e la mette nella zona scelta. */
function put(game: Game, who: 0 | 1, code: string, to: 'hand' | 'field'): [Game, string] {
  const card = game.players[who].deck.find((c) => c.cardCode === code)
  if (!card) throw new Error(`manca ${code}`)
  return [moveCard(game, who, card.id, to), card.id]
}

describe('attacco guidato', () => {
  it('nel primo turno non si attacca; il bersaglio è il Leader o un Personaggio a riposo', () => {
    const first = startGame(newGame([deck, deck], 0, seeded(3)), [2, 2])
    expect(canAttack(first, 0, first.players[0].leader.id)).toBe(false)
    const [withCard, rested] = put(setup(), 0, 'AA-002', 'field')
    const game = toggleRest(withCard, 0, rested)
    const [, active] = put(game, 0, 'AA-003', 'field')
    expect(canAttack(game, 1, game.players[1].leader.id)).toBe(true)
    expect(attackTargets(game, 1)).toEqual([game.players[0].leader.id, rested])
    expect(attackTargets(game, 1)).not.toContain(active)
  })

  it('l’attaccante si riposa; "Annulla" riporta tutto a prima', () => {
    const game = setup()
    const attacking = startAttack(game, game.players[1].leader.id, game.players[0].leader.id)
    expect(attacking.players[1].leader.rested).toBe(true)
    expect(attacking.battle?.step).toBe('block')
    expect(cancelBattle(attacking)).toBe(game)
  })

  it('DON!! dell’attaccante, Counter e bonus contano solo in questa battaglia', () => {
    const ready = setup()
    const [withCounter, counterId] = put(
      giveDon(ready, 1, ready.players[1].leader.id),
      0,
      'AA-003',
      'hand',
    )
    let game = withCounter
    game = startAttack(game, game.players[1].leader.id, game.players[0].leader.id)
    game = skipBlock(game)
    expect(battlePowers(game, facts)).toEqual({ attacker: 6000, defender: 5000 })
    game = playCounter(game, counterId, facts)
    game = addBonus(game, 'defender', 1000)
    expect(battlePowers(game, facts)).toEqual({ attacker: 6000, defender: 8000 })
    expect(game.players[0].trash.map((c) => c.id)).toContain(counterId)
    const after = resolveBattle(game, facts)
    expect(after.battle).toBeNull()
    expect(after.players[0].life).toHaveLength(2)
  })

  it('Blocker: il Personaggio diventa il bersaglio e, perdendo, va K.O.', () => {
    let game = setup()
    let blocker
    ;[game, blocker] = put(game, 0, 'AA-002', 'field')
    expect(block(game, blocker, facts)).toBe(game)
    ;[game, blocker] = put(game, 0, 'AA-003', 'field')
    game = giveDon(giveDon(game, 1, game.players[1].leader.id), 1, game.players[1].leader.id)
    game = startAttack(game, game.players[1].leader.id, game.players[0].leader.id)
    game = block(game, blocker, facts)
    expect(game.battle).toMatchObject({ targetId: blocker, step: 'counter' })
    const after = resolveBattle(game, facts)
    expect(after.players[0].trash.map((c) => c.id)).toContain(blocker)
    expect(after.players[0].life).toHaveLength(2)
  })

  it('colpo al Leader: una Vita in mano, due con [Double Attack]; a zero Vite si vince', () => {
    let game = setup()
    let attacker
    ;[game, attacker] = put(game, 1, 'AA-004', 'field')
    game = startAttack(game, attacker, game.players[0].leader.id)
    game = resolveBattle(skipBlock(game), facts)
    // 4000 contro 5000: non passa.
    expect(game.players[0].life).toHaveLength(2)
    game = setup()
    ;[game, attacker] = put(game, 1, 'AA-004', 'field')
    game = giveDon(game, 1, attacker)
    const hand = game.players[0].hand.length
    game = resolveBattle(skipBlock(startAttack(game, attacker, game.players[0].leader.id)), facts)
    const lifeCodes = game.players[0].life.length
    // Due Vite tolte (salvo Trigger in attesa).
    if (game.battle?.step !== 'trigger') {
      expect(lifeCodes).toBe(0)
      expect(game.players[0].hand).toHaveLength(hand + 2)
    }
  })

  it('Trigger: domanda solo se la carta ce l’ha; sì = cestino, no = mano', () => {
    let game = setup()
    // La Vita in cima del difensore diventa una carta col Trigger.
    const top = game.players[0].life[0]
    if (!top) throw new Error('vita')
    const triggerCard = game.players[0].deck.find((c) => c.cardCode === 'AA-005')
    if (!triggerCard) throw new Error('trigger')
    game = moveCard(game, 0, triggerCard.id, 'life')
    game = giveDon(game, 1, game.players[1].leader.id)
    game = resolveBattle(
      skipBlock(startAttack(game, game.players[1].leader.id, game.players[0].leader.id)),
      facts,
    )
    expect(game.battle?.step).toBe('trigger')
    expect(game.players[0].life[0]).toMatchObject({ id: triggerCard.id, faceUp: true })
    expect(cancelBattle(game)).toBe(game)
    const yes = answerTrigger(game, true, facts)
    expect(yes.players[0].trash.map((c) => c.id)).toContain(triggerCard.id)
    expect(yes.battle).toBeNull()
    const no = answerTrigger(game, false, facts)
    expect(no.players[0].hand.map((c) => c.id)).toContain(triggerCard.id)
  })

  it('danno con la Vita a zero: vince chi attacca', () => {
    let game = setup()
    for (const c of [...game.players[0].life]) game = moveCard(game, 0, c.id, 'trash')
    game = giveDon(game, 1, game.players[1].leader.id)
    game = resolveBattle(
      skipBlock(startAttack(game, game.players[1].leader.id, game.players[0].leader.id)),
      facts,
    )
    expect(game.winner).toBe(1)
    expect(game.battle).toBeNull()
    expect(canAttack(game, 1, game.players[1].leader.id)).toBe(false)
  })
})
