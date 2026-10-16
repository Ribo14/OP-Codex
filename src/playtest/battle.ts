import {
  cardPower,
  findCard,
  flipLife,
  moveCard,
  toggleRest,
  type Battle,
  type Game,
  type PlayerId,
} from './game'

// Attacco guidato (RIB-104): solo la struttura della battaglia (regole 7-1), come nell'app
// ufficiale. Gli effetti delle carte ([When Attacking], [On Block], i Counter degli Eventi...)
// restano a mano (ADR-0011): l'app li mostra, e la potenza in più si aggiunge con un tocco.

/** Quello che serve sapere di una carta dal catalogo. */
export interface CardFacts {
  power: number | null
  counter: number | null
  blocker: boolean
  doubleAttack: boolean
  trigger: boolean
}
export type Facts = (cardCode: string) => CardFacts

const other = (who: PlayerId): PlayerId => (who === 0 ? 1 : 0)

/** Chi può attaccare: Leader o Personaggio attivo di chi è di turno, non nel primo turno. */
export function canAttack(game: Game, who: PlayerId, id: string): boolean {
  if (game.battle || game.winner !== null || game.active !== who || game.turn < 2) return false
  const found = findCard(game.players[who], id)
  return (found?.zone === 'leader' || found?.zone === 'field') && !found.card.rested
}

/** Bersagli possibili: il Leader avversario e i suoi Personaggi a riposo. */
export function attackTargets(game: Game, attacker: PlayerId): string[] {
  const side = game.players[other(attacker)]
  return [side.leader.id, ...side.field.filter((c) => c.rested).map((c) => c.id)]
}

export function startAttack(game: Game, attackerId: string, targetId: string): Game {
  const who = game.active
  if (!canAttack(game, who, attackerId) || !attackTargets(game, who).includes(targetId)) {
    return game
  }
  const battle: Battle = {
    attacker: who,
    attackerId,
    targetId,
    step: 'block',
    attackerBonus: 0,
    defenderBonus: 0,
    lifeLeft: 0,
    before: game,
  }
  return { ...toggleRest(game, who, attackerId), battle }
}

const withBattle = (game: Game, change: Partial<Battle>): Game =>
  game.battle ? { ...game, battle: { ...game.battle, ...change } } : game

/** Blocker: un Personaggio attivo del difensore con [Blocker] diventa il bersaglio. */
export function block(game: Game, blockerId: string, facts: Facts): Game {
  const b = game.battle
  if (b?.step !== 'block') return game
  const defender = other(b.attacker)
  const found = findCard(game.players[defender], blockerId)
  if (found?.zone !== 'field' || found.card.rested || !facts(found.card.cardCode).blocker) {
    return game
  }
  return withBattle(toggleRest(game, defender, blockerId), { targetId: blockerId, step: 'counter' })
}

export function skipBlock(game: Game): Game {
  return game.battle?.step === 'block' ? withBattle(game, { step: 'counter' }) : game
}

/** Counter: il difensore scarta una carta della mano col suo valore di Counter. */
export function playCounter(game: Game, cardId: string, facts: Facts): Game {
  const b = game.battle
  if (b?.step !== 'counter') return game
  const defender = other(b.attacker)
  const found = findCard(game.players[defender], cardId)
  const value = found?.zone === 'hand' ? facts(found.card.cardCode).counter : null
  if (!value) return game
  return withBattle(moveCard(game, defender, cardId, 'trash'), {
    defenderBonus: b.defenderBonus + value,
  })
}

/** Potenza in più da effetti applicati a mano (Eventi Counter, [When Attacking]...). */
export function addBonus(game: Game, side: 'attacker' | 'defender', amount: number): Game {
  const b = game.battle
  if (!b || b.step === 'trigger') return game
  return side === 'attacker'
    ? withBattle(game, { attackerBonus: b.attackerBonus + amount })
    : withBattle(game, { defenderBonus: b.defenderBonus + amount })
}

/** "Annulla": tutto come prima dell'attacco, finché la battaglia non è risolta. */
export function cancelBattle(game: Game): Game {
  const b = game.battle
  return b && b.step !== 'trigger' ? b.before : game
}

/** Le due potenze a confronto: DON!! (solo nel turno di chi li ha) e bonus della battaglia. */
export function battlePowers(game: Game, facts: Facts): { attacker: number; defender: number } {
  const b = game.battle
  if (!b) return { attacker: 0, defender: 0 }
  const defender = other(b.attacker)
  const a = findCard(game.players[b.attacker], b.attackerId)?.card
  const d = findCard(game.players[defender], b.targetId)?.card
  const power = (who: PlayerId, card: typeof a) =>
    card ? (cardPower(game, who, card, facts(card.cardCode).power) ?? 0) : 0
  return {
    attacker: power(b.attacker, a) + b.attackerBonus,
    defender: power(defender, d) + b.defenderBonus,
  }
}

/** Danno al Leader: una Vita alla volta, con la domanda sul Trigger quando la carta ne ha uno. */
function takeLife(game: Game, facts: Facts): Game {
  const b = game.battle
  if (!b) return game
  if (b.lifeLeft === 0) return { ...game, battle: null }
  const defender = other(b.attacker)
  const top = game.players[defender].life[0]
  // Danno con la Vita a zero: la partita è finita.
  if (!top) return { ...game, battle: null, winner: b.attacker }
  const next = withBattle(game, { lifeLeft: b.lifeLeft - 1 })
  if (facts(top.cardCode).trigger) {
    return withBattle(top.faceUp ? next : flipLife(next, defender, top.id), { step: 'trigger' })
  }
  return takeLife(moveCard(next, defender, top.id, 'hand'), facts)
}

/** "Passa": si confrontano le potenze; chi attacca vince a parità. */
export function resolveBattle(game: Game, facts: Facts): Game {
  const b = game.battle
  if (b?.step !== 'counter') return game
  const { attacker, defender } = battlePowers(game, facts)
  if (attacker < defender) return { ...game, battle: null }
  const defenderSide = game.players[other(b.attacker)]
  if (b.targetId !== defenderSide.leader.id) {
    return { ...moveCard(game, other(b.attacker), b.targetId, 'trash'), battle: null }
  }
  const attackerCard = findCard(game.players[b.attacker], b.attackerId)?.card
  const hits = attackerCard && facts(attackerCard.cardCode).doubleAttack ? 2 : 1
  return takeLife(withBattle(game, { lifeLeft: hits }), facts)
}

/** La Vita col Trigger: attivato va nel cestino (l'effetto si applica a mano), altrimenti in mano. */
export function answerTrigger(game: Game, activate: boolean, facts: Facts): Game {
  const b = game.battle
  if (b?.step !== 'trigger') return game
  const defender = other(b.attacker)
  const top = game.players[defender].life[0]
  if (!top) return { ...game, battle: null }
  const moved = moveCard(game, defender, top.id, activate ? 'trash' : 'hand')
  return takeLife(withBattle(moved, { step: 'counter' }), facts)
}
