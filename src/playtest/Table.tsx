import { MoreHorizontal, X } from 'lucide-react'
import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DECKS_PATH } from '@/decks/paths'
import { cn } from '@/lib/utils'
import {
  cardPower,
  changeDon,
  donInPlay,
  draw,
  FIELD_SIZE,
  findCard,
  flipLife,
  giveDon,
  moveCard,
  nextTurn,
  shuffleDeck,
  takeDon,
  toggleRest,
  type DonAction,
  type Game,
  type PlayerId,
  type TableCard,
  type Zone,
} from './game'
import { BigNumber, CardBack, CardFace, FieldCardView, type ByCode } from './table-parts'

// Il tavolo (RIB-99), disposto come l'app ufficiale (scelta dell'utente sugli screenshot di
// riferimento, 13/10): il tuo lato in basso con il Leader al centro, Vita e DON!! nell'angolo in
// basso a sinistra, mano a ventaglio in basso a destra; l'avversario a specchio in alto. Le carte
// si muovono con tocco + menu (il pannello a destra); un tocco su una zona vuota lo chiude.

const ME: PlayerId = 0
const OPPONENT: PlayerId = 1
const random = () => Math.random()
const PHASES = ['refresh', 'draw', 'don', 'main'] as const
type Phase = (typeof PHASES)[number]
const PHASE_MS = 450

type Selection =
  | { kind: 'card'; who: PlayerId; id: string }
  | { kind: 'don' | 'deck' | 'trash' | 'hand'; who: PlayerId }
  | { kind: 'menu' }
  | null

/** Linea di mezzo del tavolo, in percentuale dell'altezza: l'avversario è lo specchio. */
const MIDDLE = 47

/** Posizione del centro di un elemento del tuo lato; quello dell'avversario è a specchio. */
function place(x: number, y: number, mirrored: boolean): CSSProperties {
  return {
    left: `${String(mirrored ? 100 - x : x)}%`,
    top: `${String(mirrored ? 2 * MIDDLE - y : y)}%`,
  }
}

const AT = 'absolute -translate-x-1/2 -translate-y-1/2'

// Trascinamento (RIB-100), con i Pointer Events: dito, mouse e penna. Sotto la soglia è un tocco
// (apre il menu); la zona di arrivo è l'elemento con data-zone sotto il dito al rilascio.
const DRAG_THRESHOLD_PX = 8
const ZONE_ATTR = 'data-zone'
const OWNER_ATTR = 'data-owner'

interface Drag {
  who: PlayerId
  id: string
  startX: number
  startY: number
  x: number
  y: number
  started: boolean
}

/** Cosa serve a carte e zone per il trascinamento. */
interface Pointer {
  /** Da mettere su onPointerDown di una carta che si può trascinare. */
  start: (who: PlayerId, id: string) => (e: ReactPointerEvent) => void
  /** Vero (una volta) se il click appena arrivato chiude un trascinamento: va ignorato. */
  consumeClick: () => boolean
  /** Di chi è la carta trascinata: si evidenziano le sue zone. */
  dropFor: PlayerId | null
}

/** Attributi di una zona di arrivo. */
const zone = (who: PlayerId, z: Zone) => ({ [ZONE_ATTR]: z, [OWNER_ATTR]: String(who) })

/** Zone valide evidenziate durante il trascinamento. */
const DROP = 'outline-2 outline-offset-2 outline-sky-500/70 outline-dashed'

export function Table({
  game,
  setGame,
  byCode,
  onNewGame,
}: {
  game: Game
  setGame: (game: Game) => void
  byCode: ByCode
  onNewGame: () => void
}) {
  const { t } = useTranslation()
  const [selection, setSelection] = useState<Selection>(null)
  const [phase, setPhase] = useState<Phase>('main')
  const timers = useRef<number[]>([])

  useEffect(
    () => () => {
      for (const id of timers.current) window.clearTimeout(id)
    },
    [],
  )

  // Fine del turno: l'app fa Refresh, pesca e DON!! del giocatore successivo e mostra le fasi.
  const endTurn = () => {
    setSelection(null)
    setGame(nextTurn(game))
    for (const id of timers.current) window.clearTimeout(id)
    timers.current = PHASES.map((p, i) =>
      window.setTimeout(() => {
        setPhase(p)
      }, i * PHASE_MS),
    )
  }

  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const justDragged = useRef(false)
  const gameRef = useRef(game)
  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const started =
        d.started || Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > DRAG_THRESHOLD_PX
      const next = { ...d, x: e.clientX, y: e.clientY, started }
      dragRef.current = next
      if (started) setDrag(next)
    }
    const up = (e: PointerEvent) => {
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!d?.started) return
      // Il click che segue il rilascio non deve aprire il menu; se non arriva, si dimentica.
      justDragged.current = true
      window.setTimeout(() => {
        justDragged.current = false
      }, 0)
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(`[${ZONE_ATTR}]`)
      const to = target?.getAttribute(ZONE_ATTR) as Zone | null | undefined
      if (to && target?.getAttribute(OWNER_ATTR) === String(d.who)) {
        setGame(moveCard(gameRef.current, d.who, d.id, to))
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [setGame])

  const pointer: Pointer = {
    start: (who, id) => (e) => {
      if (e.button !== 0) return
      dragRef.current = {
        who,
        id,
        startX: e.clientX,
        startY: e.clientY,
        x: e.clientX,
        y: e.clientY,
        started: false,
      }
    },
    consumeClick: () => {
      const was = justDragged.current
      justDragged.current = false
      return was
    },
    dropFor: drag?.started ? drag.who : null,
  }
  const dragged = drag?.started ? findCard(game.players[drag.who], drag.id)?.card : undefined

  const selectedId = selection?.kind === 'card' ? selection.id : null
  const started = game.turn > 0

  return (
    <div
      className="[container-type:size] relative h-full w-full overflow-hidden bg-gradient-to-b from-red-500/10 via-background to-sky-500/10 select-none [--card-h:15cqh] [-webkit-touch-callout:none]"
      onClick={(e) => {
        if (!(e.target as Element).closest('button, a, select, [data-panel]')) setSelection(null)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
      }}
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 border-t border-dashed border-foreground/20"
        style={{ top: `${String(MIDDLE)}%` }}
      />

      <Side
        who={OPPONENT}
        game={game}
        byCode={byCode}
        mirrored
        selectedId={selectedId}
        onSelect={setSelection}
        pointer={pointer}
      />
      <Side
        who={ME}
        game={game}
        byCode={byCode}
        mirrored={false}
        selectedId={selectedId}
        onSelect={setSelection}
        pointer={pointer}
      />

      {/* Fase e turno, sulla linea di mezzo a sinistra. */}
      {started && (
        <p
          role="status"
          className="absolute left-0 max-w-[40cqw] -translate-y-1/2 truncate rounded-r-full bg-foreground py-1 pr-4 pl-3 text-xs font-semibold text-background shadow"
          style={{ top: `${String(MIDDLE)}%` }}
        >
          {t(`playtest.phase.${phase}`)} · {t('playtest.turn', { turn: game.turn })} ·{' '}
          {game.active === ME ? t('playtest.yourTurn') : t('playtest.theirTurn')}
        </p>
      )}

      {/* Fine del turno e menu, a destra. */}
      <button
        type="button"
        disabled={!started}
        onClick={endTurn}
        className="absolute right-[1.5cqw] flex size-[17cqh] min-h-14 min-w-14 -translate-y-1/2 items-center justify-center rounded-full border-4 border-sky-300/60 bg-gradient-to-br from-sky-700 to-slate-900 p-1 text-center text-[clamp(0.65rem,2.6cqh,0.95rem)] leading-tight font-bold text-white shadow-lg disabled:opacity-40"
        style={{ top: `${String(MIDDLE)}%` }}
      >
        {t('playtest.endTurn')}
      </button>
      <button
        type="button"
        aria-label={t('playtest.menu')}
        onClick={() => {
          setSelection({ kind: 'menu' })
        }}
        className="absolute top-[62%] right-[3cqw] inline-flex size-10 items-center justify-center rounded-full border bg-background/80 shadow"
      >
        <MoreHorizontal className="size-5" aria-hidden="true" />
      </button>

      {selection && (
        <Panel
          game={game}
          setGame={setGame}
          byCode={byCode}
          selection={selection}
          setSelection={setSelection}
          onNewGame={onNewGame}
        />
      )}

      {/* La carta che segue il dito durante il trascinamento. */}
      {drag && dragged && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-1/2 opacity-90"
          style={{ left: drag.x, top: drag.y }}
        >
          <CardFace
            cardCode={dragged.cardCode}
            printId={dragged.printId}
            byCode={byCode}
            className="h-[calc(var(--card-h)*1.2)] shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}

function Side({
  who,
  game,
  byCode,
  mirrored,
  selectedId,
  onSelect,
  pointer,
}: {
  who: PlayerId
  game: Game
  byCode: ByCode
  mirrored: boolean
  selectedId: string | null
  onSelect: (s: Selection) => void
  pointer: Pointer
}) {
  const { t } = useTranslation()
  const side = game.players[who]
  const drop = pointer.dropFor === who ? DROP : ''
  const don = donInPlay(side)
  const topOfTrash = side.trash.at(-1)
  const topOfLife = side.life[0]
  const pile = 'relative block h-[calc(var(--card-h)*0.85)]'
  const counter = 'absolute inset-0 flex items-center justify-center text-[calc(var(--card-h)*0.3)]'

  const field = (card: TableCard, leader = false) => {
    const printed = byCode.get(card.cardCode)?.power ?? null
    const power = cardPower(game, who, card, printed)
    return (
      <button
        key={card.id}
        type="button"
        data-card
        aria-label={`${byCode.get(card.cardCode)?.name ?? card.cardCode}${power === null ? '' : `, ${t('playtest.power', { power })}`}`}
        // Il Leader non lascia mai il suo posto: niente trascinamento.
        onPointerDown={leader ? undefined : pointer.start(who, card.id)}
        onClick={() => {
          if (pointer.consumeClick()) return
          onSelect({ kind: 'card', who, id: card.id })
        }}
        className={cn(
          'rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
          !leader && 'touch-none',
          leader && 'ring-2 ring-amber-400/80',
          selectedId === card.id && 'ring-2 ring-sky-400',
        )}
      >
        <FieldCardView
          card={card}
          byCode={byCode}
          power={power}
          boosted={power !== null && printed !== null && power > printed}
        />
      </button>
    )
  }

  return (
    <section aria-label={who === ME ? t('playtest.yourHand') : t('playtest.theirHand')}>
      {/* Area Personaggi. */}
      <div
        aria-label={t('playtest.characters')}
        className={cn(
          AT,
          'flex h-[calc(var(--card-h)*1.18)] w-[42cqw] items-center justify-center gap-[1cqw] rounded-xl border border-foreground/10 bg-foreground/[0.04] px-2',
          drop,
        )}
        style={place(50, 58, mirrored)}
        {...zone(who, 'field')}
      >
        {side.field.length === 0 ? (
          <span className="text-[3cqh] font-semibold text-foreground/25">
            {t('playtest.characters')}
          </span>
        ) : (
          side.field.map((c) => field(c))
        )}
      </div>

      {/* Leader al centro. */}
      <div className={AT} style={place(50, 81, mirrored)}>
        {field(side.leader, true)}
      </div>

      {/* Stage e mazzo DON!! a sinistra (a destra per l'avversario). */}
      <div
        className={cn(AT, 'rounded-md', drop)}
        style={place(25.5, 58, mirrored)}
        {...zone(who, 'stage')}
      >
        {side.stage ? (
          field(side.stage)
        ) : (
          <span className="flex aspect-[63/88] h-[var(--card-h)] items-center justify-center rounded-md border border-dashed border-foreground/25 text-[2.4cqh] text-foreground/40">
            {t('playtest.stage')}
          </span>
        )}
      </div>
      <button
        type="button"
        aria-label={t('playtest.donDeck', { count: side.donDeck })}
        onClick={() => {
          onSelect({ kind: 'don', who })
        }}
        className={AT}
        style={place(18, 58, mirrored)}
      >
        <span className={pile}>
          <CardBack tone="don" className="h-full" />
          <BigNumber value={side.donDeck} className={counter} />
        </span>
      </button>

      {/* Mazzo e Scarti a destra (a sinistra per l'avversario). */}
      <button
        type="button"
        aria-label={t('playtest.deck', { count: side.deck.length })}
        onClick={() => {
          onSelect({ kind: 'deck', who })
        }}
        className={cn(AT, 'rounded-md', drop)}
        style={place(75.5, 58, mirrored)}
        {...zone(who, 'deckBottom')}
      >
        <span className={pile}>
          <CardBack className="h-full" />
          <BigNumber value={side.deck.length} className={counter} />
        </span>
      </button>
      <button
        type="button"
        aria-label={t('playtest.trash', { count: side.trash.length })}
        onClick={() => {
          onSelect({ kind: 'trash', who })
        }}
        className={cn(AT, 'rounded-md', drop)}
        style={place(82.5, 58, mirrored)}
        {...zone(who, 'trash')}
      >
        <span className={pile}>
          {topOfTrash ? (
            <CardFace
              cardCode={topOfTrash.cardCode}
              printId={topOfTrash.printId}
              byCode={byCode}
              className="h-full opacity-90"
            />
          ) : (
            <span className="flex aspect-[63/88] h-full items-center justify-center rounded-md border border-dashed border-foreground/25 text-[2.2cqh] text-foreground/40">
              {t('playtest.trashShort')}
            </span>
          )}
          {side.trash.length > 0 && <BigNumber value={side.trash.length} className={counter} />}
        </span>
      </button>

      {/* Vita (una carta col numero) e contatore DON!!, nell'angolo. */}
      <button
        type="button"
        aria-label={t('playtest.life', { count: side.life.length })}
        onClick={() => {
          if (topOfLife) onSelect({ kind: 'card', who, id: topOfLife.id })
        }}
        className={cn(AT, 'rounded-md', drop)}
        style={place(7, 84, mirrored)}
        {...zone(who, 'life')}
      >
        <span className={pile}>
          {topOfLife?.faceUp ? (
            <CardFace
              cardCode={topOfLife.cardCode}
              printId={topOfLife.printId}
              byCode={byCode}
              className="h-full"
            />
          ) : (
            <CardBack tone="life" className="h-full" />
          )}
          <BigNumber value={side.life.length} className={counter} />
        </span>
      </button>
      <button
        type="button"
        aria-label={t('playtest.donCounter', {
          active: don.active,
          total: don.total,
          rested: side.donRested,
        })}
        onClick={() => {
          onSelect({ kind: 'don', who })
        }}
        className={cn(
          AT,
          'flex flex-col items-center rounded-xl border-2 border-violet-500/50 bg-violet-700/15 px-[1.5cqw] py-[0.8cqh]',
        )}
        style={place(17.5, 86, mirrored)}
      >
        <span className="text-[2.2cqh] font-bold text-violet-700 dark:text-violet-300">
          {t('playtest.don')}
        </span>
        <BigNumber value={`${String(don.active)}/${String(don.total)}`} className="text-[6cqh]" />
      </button>

      {who === ME ? (
        <Hand
          who={who}
          game={game}
          byCode={byCode}
          selectedId={selectedId}
          onSelect={onSelect}
          pointer={pointer}
        />
      ) : (
        <button
          type="button"
          aria-label={t('playtest.handCount', { count: side.hand.length })}
          onClick={() => {
            onSelect({ kind: 'hand', who })
          }}
          className={cn(
            'absolute top-0 left-[3cqw] flex h-[13cqh] max-w-[34cqw] items-start rounded-md',
            drop,
          )}
          {...zone(who, 'hand')}
        >
          {side.hand.map((c, i) => (
            <span
              key={c.id}
              className="shrink-0"
              style={{ marginLeft: i === 0 ? 0 : 'calc(var(--card-h) * -0.45)' }}
            >
              <CardBack className="h-[15cqh] -translate-y-[35%] rotate-180" />
            </span>
          ))}
          <span className="absolute top-1 -right-2 rounded-full bg-foreground px-1.5 text-[10px] font-bold text-background">
            {side.hand.length}
          </span>
        </button>
      )}
    </section>
  )
}

/** La tua mano, a ventaglio in basso a destra: un tocco apre il menu della carta. */
function Hand({
  who,
  game,
  byCode,
  selectedId,
  onSelect,
  pointer,
}: {
  who: PlayerId
  game: Game
  byCode: ByCode
  selectedId: string | null
  onSelect: (s: Selection) => void
  pointer: Pointer
}) {
  const { t } = useTranslation()
  const hand = game.players[who].hand
  const n = hand.length
  // Più carte, più si sovrappongono: il ventaglio resta nello spazio a destra del Leader.
  const overlap = Math.min(0.62, 0.2 + n * 0.045)
  return (
    <ul
      aria-label={t('playtest.yourHand')}
      className={cn(
        'absolute right-[9cqw] bottom-0 left-[57cqw] flex h-[30cqh] items-end justify-center rounded-t-xl [--hand-h:26cqh]',
        pointer.dropFor === who && DROP,
      )}
      {...zone(who, 'hand')}
    >
      {hand.map((c, i) => {
        const angle = (i - (n - 1) / 2) * 3.5
        const selected = selectedId === c.id
        return (
          <li
            key={c.id}
            className="shrink-0"
            style={{
              marginLeft: i === 0 ? 0 : `calc(var(--hand-h) * 0.716 * ${String(-overlap)})`,
              zIndex: selected ? 20 : i,
            }}
          >
            <button
              type="button"
              data-card
              aria-label={byCode.get(c.cardCode)?.name ?? c.cardCode}
              onPointerDown={pointer.start(who, c.id)}
              onClick={() => {
                if (pointer.consumeClick()) return
                onSelect({ kind: 'card', who, id: c.id })
              }}
              className="block origin-bottom touch-none transition-transform duration-150"
              style={{
                transform: `translateY(${selected ? '2%' : '28%'}) rotate(${String(angle)}deg)`,
              }}
            >
              <CardFace
                cardCode={c.cardCode}
                printId={c.printId}
                byCode={byCode}
                className={cn('h-[var(--hand-h)] shadow-lg', selected && 'ring-2 ring-sky-400')}
              />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

interface Action {
  label: string
  run: () => void
  disabled?: boolean
  hint?: string
}

/** Il pannello a destra: azioni sulla carta scelta, DON!!, mazzo, cestino, mano, menu. */
function Panel({
  game,
  setGame,
  byCode,
  selection,
  setSelection,
  onNewGame,
}: {
  game: Game
  setGame: (game: Game) => void
  byCode: ByCode
  selection: NonNullable<Selection>
  setSelection: (s: Selection) => void
  onNewGame: () => void
}) {
  const { t } = useTranslation()
  let title: string
  let body: ReactNode

  if (selection.kind === 'card') {
    const who = selection.who
    const side = game.players[who]
    const found = findCard(side, selection.id)
    if (!found) return null
    const { zone, card } = found
    title = byCode.get(card.cardCode)?.name ?? card.cardCode
    const move = (to: Zone) => {
      setGame(moveCard(game, who, card.id, to))
      setSelection(null)
    }
    const full = side.field.length >= FIELD_SIZE
    const toField: Action = {
      label: t('playtest.do.play'),
      run: () => {
        move('field')
      },
      disabled: full,
      hint: full ? t('playtest.fieldFull') : undefined,
    }
    const actions: Action[] = []
    if (zone === 'leader' || zone === 'field' || zone === 'stage') {
      actions.push({
        label: card.rested ? t('playtest.do.activate') : t('playtest.do.rest'),
        run: () => {
          setGame(toggleRest(game, who, card.id))
        },
      })
    }
    if (zone === 'leader' || zone === 'field') {
      actions.push(
        {
          label: t('playtest.do.giveDon'),
          run: () => {
            setGame(giveDon(game, who, card.id))
          },
          disabled: side.donActive === 0,
        },
        {
          label: t('playtest.do.takeDon'),
          run: () => {
            setGame(takeDon(game, who, card.id))
          },
          disabled: card.don === 0,
        },
      )
    }
    if (zone === 'hand') {
      actions.push(toField, {
        label: t('playtest.do.stage'),
        run: () => {
          move('stage')
        },
      })
    }
    if (zone === 'life') {
      actions.push(
        {
          label: t('playtest.do.takeLife'),
          run: () => {
            move('hand')
          },
        },
        {
          label: t('playtest.do.flip'),
          run: () => {
            setGame(flipLife(game, who, card.id))
          },
        },
      )
    }
    if (zone === 'trash') actions.push(toField)
    if (zone !== 'leader') {
      if (zone !== 'hand' && zone !== 'life')
        actions.push({
          label: t('playtest.do.toHand'),
          run: () => {
            move('hand')
          },
        })
      if (zone !== 'trash')
        actions.push({
          label: t('playtest.do.trash'),
          run: () => {
            move('trash')
          },
        })
      actions.push(
        {
          label: t('playtest.do.deckTop'),
          run: () => {
            move('deckTop')
          },
        },
        {
          label: t('playtest.do.deckBottom'),
          run: () => {
            move('deckBottom')
          },
        },
      )
      if (zone !== 'life')
        actions.push({
          label: t('playtest.do.toLife'),
          run: () => {
            move('life')
          },
        })
    }
    body = (
      <>
        {(zone !== 'life' || card.faceUp || who === ME) && (
          <CardFace
            cardCode={card.cardCode}
            printId={card.printId}
            byCode={byCode}
            className="mx-auto h-[34cqh]"
          />
        )}
        <Actions actions={actions} />
      </>
    )
  } else if (selection.kind === 'don') {
    const who = selection.who
    const side = game.players[who]
    const don = (action: DonAction) => {
      setGame(changeDon(game, who, action))
    }
    title = t('playtest.don')
    body = (
      <>
        <p className="text-xs text-muted-foreground">
          {t('playtest.donCounter', {
            active: side.donActive,
            total: donInPlay(side).total,
            rested: side.donRested,
          })}
          {' · '}
          {t('playtest.donDeck', { count: side.donDeck })}
        </p>
        <Actions
          actions={[
            {
              label: t('playtest.do.donRest'),
              run: () => {
                don('rest')
              },
              disabled: side.donActive === 0,
            },
            {
              label: t('playtest.do.donActivate'),
              run: () => {
                don('activate')
              },
              disabled: side.donRested === 0,
            },
            {
              label: t('playtest.do.donAdd'),
              run: () => {
                don('add')
              },
              disabled: side.donDeck === 0,
            },
            {
              label: t('playtest.do.donReturn'),
              run: () => {
                don('return')
              },
              disabled: side.donActive + side.donRested === 0,
            },
          ]}
        />
      </>
    )
  } else if (selection.kind === 'deck') {
    const who = selection.who
    title = t('playtest.deck', { count: game.players[who].deck.length })
    body = (
      <Actions
        actions={[
          {
            label: t('playtest.do.draw'),
            run: () => {
              setGame(draw(game, who))
            },
            disabled: game.players[who].deck.length === 0,
          },
          {
            label: t('playtest.do.shuffle'),
            run: () => {
              setGame(shuffleDeck(game, who, random))
            },
          },
        ]}
      />
    )
  } else if (selection.kind === 'trash' || selection.kind === 'hand') {
    const who = selection.who
    const cards =
      selection.kind === 'trash' ? [...game.players[who].trash].reverse() : game.players[who].hand
    title =
      selection.kind === 'trash'
        ? t('playtest.trash', { count: cards.length })
        : t('playtest.theirHand')
    body = (
      <>
        {selection.kind === 'hand' && (
          <p className="text-xs text-muted-foreground">{t('playtest.theirHandHint')}</p>
        )}
        {cards.length === 0 && selection.kind === 'trash' ? (
          <p className="text-xs text-muted-foreground">{t('playtest.trashEmpty')}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-1.5">
            {cards.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  aria-label={byCode.get(c.cardCode)?.name ?? c.cardCode}
                  onClick={() => {
                    setSelection({ kind: 'card', who, id: c.id })
                  }}
                  className="block w-full"
                >
                  <CardFace
                    cardCode={c.cardCode}
                    printId={c.printId}
                    byCode={byCode}
                    className="h-auto w-full"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </>
    )
  } else {
    title = t('playtest.menu')
    body = (
      <div className="flex flex-col gap-1">
        <button type="button" onClick={onNewGame} className={ACTION}>
          {t('playtest.start')}
        </button>
        <Link to={DECKS_PATH} className={ACTION}>
          {t('playtest.exit')}
        </Link>
      </div>
    )
  }

  return (
    <aside
      data-panel
      aria-label={title}
      className="absolute inset-y-0 right-0 z-30 flex w-[clamp(12rem,28cqw,18rem)] flex-col gap-2 overflow-y-auto border-l bg-background/95 p-2 shadow-2xl backdrop-blur"
    >
      <div className="flex items-center gap-1">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{title}</p>
        <button
          type="button"
          aria-label={t('playtest.close')}
          onClick={() => {
            setSelection(null)
          }}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-full border hover:bg-muted"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      {body}
    </aside>
  )
}

const ACTION =
  'min-h-9 rounded-xl border px-3 py-1.5 text-left text-xs font-medium hover:bg-muted disabled:opacity-40'

function Actions({ actions }: { actions: Action[] }) {
  return (
    <div className="flex flex-col gap-1">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.run}
          disabled={a.disabled}
          title={a.hint}
          className={ACTION}
        >
          {a.label}
          {a.disabled && a.hint && (
            <span className="block text-[10px] font-normal text-muted-foreground">{a.hint}</span>
          )}
        </button>
      ))}
    </div>
  )
}
