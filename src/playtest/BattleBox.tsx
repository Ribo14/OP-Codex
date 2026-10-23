import { useLayoutEffect, useState, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { KeywordText } from '@/rules/KeywordText'
import {
  addBonus,
  answerTrigger,
  battlePowers,
  block,
  cancelBattle,
  resolveBattle,
  skipBlock,
  playCounter,
  type Facts,
} from './battle'
import { findCard, type Game, type PlayerId } from './game'
import type { ByCode } from './table-parts'

// Attacco guidato (RIB-104): il riquadro della battaglia, con i passaggi Blocker, Counter e
// Trigger, e la freccia dall'attaccante al bersaglio. Gli effetti restano a mano (ADR-0011).

const BONUS = 1000
const ACTION =
  'min-h-9 w-full rounded-xl border px-3 py-1.5 text-left text-xs font-medium hover:bg-muted disabled:opacity-40'
const PRIMARY =
  'min-h-9 w-full rounded-xl bg-foreground px-3 py-1.5 text-left text-xs font-semibold text-background'

const other = (who: PlayerId): PlayerId => (who === 0 ? 1 : 0)

export function BattleBox({
  game,
  setGame,
  byCode,
  facts,
  onBlocked,
}: {
  game: Game
  setGame: (game: Game) => void
  byCode: ByCode
  facts: Facts
  /** Il Blocker scelto: il tavolo ne mostra l'effetto [On Block]. */
  onBlocked: (cardCode: string) => void
}) {
  const { t } = useTranslation()
  const b = game.battle
  if (!b) return null
  const defender = other(b.attacker)
  const attacker = findCard(game.players[b.attacker], b.attackerId)?.card
  const target = findCard(game.players[defender], b.targetId)?.card
  const name = (code: string | undefined) => (code ? (byCode.get(code)?.name ?? code) : '')
  const powers = battlePowers(game, facts)
  const top = game.players[defender].life[0]

  let body
  if (b.step === 'block') {
    const blockers = game.players[defender].field.filter(
      (c) => !c.rested && c.id !== b.targetId && facts(c.cardCode).blocker,
    )
    body = (
      <>
        <p className="text-xs text-muted-foreground">{t('playtest.battle.blockStep')}</p>
        {blockers.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setGame(block(game, c.id, facts))
              onBlocked(c.cardCode)
            }}
            className={ACTION}
          >
            {t('playtest.battle.blockWith', { name: name(c.cardCode) })}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setGame(skipBlock(game))
          }}
          className={PRIMARY}
        >
          {t('playtest.battle.noBlock')}
        </button>
      </>
    )
  } else if (b.step === 'counter') {
    const counters = game.players[defender].hand.filter((c) => facts(c.cardCode).counter)
    body = (
      <>
        <p className="text-xs text-muted-foreground">{t('playtest.battle.counterStep')}</p>
        <button
          type="button"
          onClick={() => {
            setGame(resolveBattle(game, facts))
          }}
          className={PRIMARY}
        >
          {t('playtest.battle.resolve')}
        </button>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setGame(addBonus(game, 'defender', BONUS))
            }}
            className={ACTION}
          >
            {t('playtest.battle.bonusDefender')}
          </button>
          <button
            type="button"
            onClick={() => {
              setGame(addBonus(game, 'attacker', BONUS))
            }}
            className={ACTION}
          >
            {t('playtest.battle.bonusAttacker')}
          </button>
        </div>
        {counters.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setGame(playCounter(game, c.id, facts))
            }}
            className={ACTION}
          >
            {t('playtest.battle.counterWith', {
              value: facts(c.cardCode).counter,
              name: name(c.cardCode),
            })}
          </button>
        ))}
      </>
    )
  } else {
    const trigger = top ? byCode.get(top.cardCode)?.trigger : null
    body = (
      <>
        <p className="text-xs font-semibold">
          {t('playtest.battle.triggerStep', { name: name(top?.cardCode) })}
        </p>
        {trigger && (
          <p className="text-xs leading-relaxed">
            <KeywordText text={trigger} />
          </p>
        )}
        <button
          type="button"
          onClick={() => {
            setGame(answerTrigger(game, true, facts))
          }}
          className={PRIMARY}
        >
          {t('playtest.battle.triggerYes')}
        </button>
        <button
          type="button"
          onClick={() => {
            setGame(answerTrigger(game, false, facts))
          }}
          className={ACTION}
        >
          {t('playtest.battle.triggerNo')}
        </button>
      </>
    )
  }

  return (
    <section
      aria-label={t('playtest.battle.title')}
      data-panel
      className="absolute top-1/2 left-[1.5cqw] z-30 flex max-h-[90cqh] w-[clamp(13rem,30cqw,19rem)] -translate-y-1/2 flex-col gap-1.5 overflow-y-auto rounded-2xl border bg-background/95 p-2.5 shadow-2xl"
    >
      <div className="flex items-center gap-2">
        <p className="flex-1 text-sm font-semibold">{t('playtest.battle.title')}</p>
        {b.step !== 'trigger' && (
          <button
            type="button"
            onClick={() => {
              setGame(cancelBattle(game))
            }}
            className="rounded-full border px-2.5 py-1 text-xs hover:bg-muted"
          >
            {t('playtest.battle.cancel')}
          </button>
        )}
      </div>
      <p role="status" className="text-xs">
        {t('playtest.battle.vs', {
          attacker: name(attacker?.cardCode),
          a: powers.attacker,
          target: name(target?.cardCode),
          d: powers.defender,
        })}
      </p>
      {body}
    </section>
  )
}

/** La freccia dall'attaccante al bersaglio, sopra il tavolo. */
export function BattleArrow({
  root,
  fromId,
  toId,
}: {
  root: RefObject<HTMLElement | null>
  fromId: string
  toId: string
}) {
  const [line, setLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      const box = root.current?.getBoundingClientRect()
      const from = root.current
        ?.querySelector(`[data-card-id="${fromId}"]`)
        ?.getBoundingClientRect()
      const to = root.current?.querySelector(`[data-card-id="${toId}"]`)?.getBoundingClientRect()
      if (!box || !from || !to) {
        setLine(null)
        return
      }
      setLine({
        x1: from.left + from.width / 2 - box.left,
        y1: from.top + from.height / 2 - box.top,
        x2: to.left + to.width / 2 - box.left,
        y2: to.top + to.height / 2 - box.top,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
    }
  }, [root, fromId, toId])
  if (!line) return null
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 h-full w-full">
      <defs>
        <marker
          id="battle-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path d="M0 0 L10 5 L0 10 z" fill="rgb(234 179 8)" />
        </marker>
      </defs>
      <line
        {...line}
        stroke="rgb(234 179 8)"
        strokeWidth="5"
        strokeLinecap="round"
        strokeDasharray="12 8"
        markerEnd="url(#battle-arrow)"
      />
    </svg>
  )
}
