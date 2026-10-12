import { RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useSession } from '@/account/session'
import type { CatalogCard } from '@/catalog/catalog-data'
import { useCatalog } from '@/catalog/local-catalog'
import { CardThumb } from '@/decks/CardThumb'
import { shownPrinting } from '@/decks/deck'
import { listDecks } from '@/decks/decks-api'
import { DECKS_PATH } from '@/decks/paths'
import { cn } from '@/lib/utils'
import {
  changeDon,
  draw,
  findCard,
  flipLife,
  giveDon,
  moveCard,
  mulligan,
  newGame,
  nextTurn,
  shuffleDeck,
  startGame,
  takeDon,
  toggleRest,
  type DonAction,
  type Game,
  type PlayerId,
  type PlayerSide,
  type TableCard,
  type Zone,
} from './game'
import { fromDeck, starterDeck, type TableDeck } from './sample-decks'

// Playtest Table (RIB-34) — PROTOTIPO da provare su telefono e tablet: tavolo orizzontale, il
// tuo lato in basso e l'avversario in alto (per ora lo muovi tu), carte con tocco + menu e
// trascinamento, turno con la sola struttura (Refresh, pesca, DON!!). ADR-0011.

const random = () => Math.random()
const ME: PlayerId = 0
const OPPONENT: PlayerId = 1
const FIRST_OPTIONS = ['random', 'me', 'opponent'] as const

type Selection =
  | { kind: 'card'; who: PlayerId; id: string }
  | { kind: 'don'; who: PlayerId }
  | { kind: 'trash'; who: PlayerId }
  | null

export function PlaytestPage() {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const session = useSession()
  const byCode = useMemo(
    () => new Map((catalog?.cards ?? []).map((c) => [c.cardCode, c])),
    [catalog],
  )
  const [own, setOwn] = useState<TableDeck[]>([])
  const signedIn = session.status === 'signedIn'

  useEffect(() => {
    if (!signedIn || byCode.size === 0) return
    let current = true
    listDecks().then(
      (decks) => {
        if (!current) return
        setOwn(
          decks.flatMap(({ deck, cards }) => {
            const d = fromDeck(
              deck.id,
              deck.name,
              deck.leaderCode,
              deck.leaderPrintId,
              cards,
              byCode,
            )
            return d ? [d] : []
          }),
        )
      },
      () => undefined,
    )
    return () => {
      current = false
    }
  }, [signedIn, byCode])

  const decks = useMemo(() => {
    const starters = ['ST01', 'ST02', 'ST03', 'ST04'].flatMap((p) => {
      const d = starterDeck(p, catalog?.cards ?? [])
      return d ? [d] : []
    })
    return [...own, ...starters]
  }, [own, catalog])

  const [game, setGame] = useState<Game | null>(null)

  if (!catalog) return <p className="text-muted-foreground">{t('catalog.loading')}</p>

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background text-foreground">
      {game ? (
        <Table game={game} setGame={setGame} byCode={byCode} />
      ) : (
        <Setup decks={decks} byCode={byCode} onStart={setGame} />
      )}
      <RotateHint />
    </div>
  )
}

/** In verticale sul telefono: invito a ruotare. */
function RotateHint() {
  const { t } = useTranslation()
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] hidden items-center justify-center bg-background/95 p-8 text-center portrait:max-sm:flex">
      <div className="space-y-3">
        <RotateCcw className="mx-auto size-10" aria-hidden="true" />
        <p className="text-lg font-medium">{t('playtest.rotate')}</p>
      </div>
    </div>
  )
}

function Setup({
  decks,
  byCode,
  onStart,
}: {
  decks: TableDeck[]
  byCode: ReadonlyMap<string, CatalogCard>
  onStart: (game: Game) => void
}) {
  const { t } = useTranslation()
  const [mine, setMine] = useState('')
  const [theirs, setTheirs] = useState('')
  const [first, setFirst] = useState<(typeof FIRST_OPTIONS)[number]>('random')
  const [pending, setPending] = useState<Game | null>(null)

  const pick = (id: string, fallback: number) => decks.find((d) => d.id === id) ?? decks[fallback]
  const a = pick(mine, 0)
  const b = pick(theirs, Math.min(1, decks.length - 1))

  if (pending && a && b) {
    return (
      <Mulligan
        game={pending}
        byCode={byCode}
        onMulligan={() => {
          setPending(mulligan(pending, ME, random))
        }}
        onKeep={() => {
          onStart(startGame(pending, [a.list.leader.life, b.list.leader.life]))
        }}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 overflow-y-auto p-6">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-semibold tracking-tight">{t('playtest.title')}</h1>
        <Link
          to={DECKS_PATH}
          aria-label={t('playtest.exit')}
          className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted"
        >
          <X className="size-5" aria-hidden="true" />
        </Link>
      </div>
      <p className="text-sm text-muted-foreground">{t('playtest.intro')}</p>
      <DeckSelect
        label={t('playtest.myDeck')}
        decks={decks}
        value={a?.id ?? ''}
        onChange={setMine}
      />
      <DeckSelect
        label={t('playtest.opponentDeck')}
        decks={decks}
        value={b?.id ?? ''}
        onChange={setTheirs}
      />
      <label className="space-y-1 text-sm">
        <span className="font-medium">{t('playtest.whoStarts')}</span>
        <select
          value={first}
          onChange={(e) => {
            setFirst(e.target.value as typeof first)
          }}
          className="h-10 w-full rounded-xl border bg-background px-3"
        >
          {FIRST_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {t(`playtest.first.${option}`)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        disabled={!a || !b}
        onClick={() => {
          if (!a || !b) return
          const who: PlayerId =
            first === 'me' ? ME : first === 'opponent' ? OPPONENT : random() < 0.5 ? ME : OPPONENT
          setPending(newGame([a.list, b.list], who, random))
        }}
        className="h-11 rounded-full bg-foreground font-medium text-background disabled:opacity-50"
      >
        {t('playtest.sit')}
      </button>
    </div>
  )
}

function DeckSelect({
  label,
  decks,
  value,
  onChange,
}: {
  label: string
  decks: TableDeck[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <label className="space-y-1 text-sm">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        className="h-10 w-full rounded-xl border bg-background px-3"
      >
        {decks.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function Mulligan({
  game,
  byCode,
  onMulligan,
  onKeep,
}: {
  game: Game
  byCode: ReadonlyMap<string, CatalogCard>
  onMulligan: () => void
  onKeep: () => void
}) {
  const { t } = useTranslation()
  const me = game.players[ME]
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
      <p className="font-medium">
        {game.first === ME ? t('playtest.youStart') : t('playtest.opponentStarts')}
      </p>
      <div className="flex max-w-full gap-2 overflow-x-auto">
        {me.hand.map((c) => (
          <CardFace key={c.id} card={c} byCode={byCode} className="h-[38vh]" />
        ))}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          disabled={me.mulliganUsed}
          onClick={onMulligan}
          className="h-11 rounded-full border px-5 font-medium disabled:opacity-50"
        >
          {t('playtest.mulligan')}
        </button>
        <button
          type="button"
          onClick={onKeep}
          className="h-11 rounded-full bg-foreground px-5 font-medium text-background"
        >
          {t('playtest.keep')}
        </button>
      </div>
    </div>
  )
}

/** L'immagine di una carta del tavolo (a faccia in su). */
function CardFace({
  card,
  byCode,
  className,
}: {
  card: TableCard
  byCode: ReadonlyMap<string, CatalogCard>
  className?: string
}) {
  const info = byCode.get(card.cardCode)
  const printing = info ? shownPrinting(info, card.printId) : undefined
  return (
    <CardThumb
      printing={printing}
      name={info?.name ?? card.cardCode}
      className={cn('aspect-[63/88] w-auto max-w-none rounded-md object-cover', className)}
    />
  )
}

/** Dorso di una carta (mazzo, Vita coperta). */
function CardBack({ className, label }: { className?: string; label: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex aspect-[63/88] items-center justify-center rounded-md border-2 border-background bg-gradient-to-br from-red-700 to-red-950 text-[10px] font-bold text-white/80 shadow',
        className,
      )}
    >
      {label}
    </div>
  )
}

// --- Il tavolo -----------------------------------------------------------------------------

interface Drag {
  who: PlayerId
  id: string
  x: number
  y: number
  started: boolean
  startX: number
  startY: number
  fromHand: boolean
}

const ZONE_ATTR = 'data-zone'
const PLAYER_ATTR = 'data-player'

function zoneProps(who: PlayerId, zone: Zone) {
  return { [ZONE_ATTR]: zone, [PLAYER_ATTR]: String(who) }
}

function Table({
  game,
  setGame,
  byCode,
}: {
  game: Game
  setGame: (game: Game) => void
  byCode: ReadonlyMap<string, CatalogCard>
}) {
  const { t } = useTranslation()
  const [selection, setSelection] = useState<Selection>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const gameRef = useRef(game)
  useEffect(() => {
    gameRef.current = game
  }, [game])

  // Trascinamento con i Pointer Events: funziona con mouse, penna e dito. Sotto gli 8 px è un
  // tocco (si apre il menu); dalla mano serve un movimento verso l'alto, così la mano scorre.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current
      if (!d) return
      const dx = e.clientX - d.startX
      const dy = e.clientY - d.startY
      const started =
        d.started || (d.fromHand ? dy < -12 && Math.abs(dy) > Math.abs(dx) : Math.hypot(dx, dy) > 8)
      const next = { ...d, x: e.clientX, y: e.clientY, started }
      dragRef.current = next
      if (started) setDrag(next)
    }
    const up = (e: PointerEvent) => {
      const d = dragRef.current
      dragRef.current = null
      setDrag(null)
      if (!d) return
      if (!d.started) {
        setSelection({ kind: 'card', who: d.who, id: d.id })
        return
      }
      const target = document.elementFromPoint(e.clientX, e.clientY)?.closest(`[${ZONE_ATTR}]`)
      const zone = target?.getAttribute(ZONE_ATTR) as Zone | null | undefined
      const owner = target?.getAttribute(PLAYER_ATTR)
      if (zone && owner === String(d.who)) setGame(moveCard(gameRef.current, d.who, d.id, zone))
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

  const startDrag = (who: PlayerId, id: string, fromHand: boolean) => (e: ReactPointerEvent) => {
    if (e.button !== 0) return
    dragRef.current = {
      who,
      id,
      x: e.clientX,
      y: e.clientY,
      startX: e.clientX,
      startY: e.clientY,
      started: false,
      fromHand,
    }
  }

  const dragged = drag ? findCard(game.players[drag.who], drag.id)?.card : undefined
  const handOwner = game.active

  return (
    <div className="flex min-h-0 flex-1 select-none">
      <div className="flex min-w-0 flex-1 flex-col">
        <Half
          who={OPPONENT}
          side={game.players[OPPONENT]}
          byCode={byCode}
          flipped
          startDrag={startDrag}
          onSelect={setSelection}
          onDraw={() => {
            setGame(draw(game, OPPONENT))
          }}
          dragging={drag?.started === true}
        />
        <div className="flex h-7 shrink-0 items-center justify-center gap-3 border-y bg-muted/40 text-xs">
          <span className="font-medium">
            {t('playtest.turn', { turn: game.turn })} ·{' '}
            {game.active === ME ? t('playtest.yourTurn') : t('playtest.theirTurn')}
          </span>
        </div>
        <Half
          who={ME}
          side={game.players[ME]}
          byCode={byCode}
          startDrag={startDrag}
          onSelect={setSelection}
          onDraw={() => {
            setGame(draw(game, ME))
          }}
          dragging={drag?.started === true}
        />
        <Hand
          who={handOwner}
          side={game.players[handOwner]}
          byCode={byCode}
          startDrag={startDrag}
          selected={selection?.kind === 'card' ? selection.id : null}
        />
      </div>
      <SidePanel
        game={game}
        setGame={setGame}
        byCode={byCode}
        selection={selection}
        setSelection={setSelection}
      />
      {drag?.started && dragged && (
        <div
          className="pointer-events-none fixed z-[70] -translate-x-1/2 -translate-y-1/2 opacity-90"
          style={{ left: drag.x, top: drag.y }}
        >
          <CardFace card={dragged} byCode={byCode} className="h-[22vh] shadow-2xl" />
        </div>
      )}
    </div>
  )
}

function Half({
  who,
  side,
  byCode,
  flipped = false,
  startDrag,
  onSelect,
  onDraw,
  dragging,
}: {
  who: PlayerId
  side: PlayerSide
  byCode: ReadonlyMap<string, CatalogCard>
  flipped?: boolean
  startDrag: (who: PlayerId, id: string, fromHand: boolean) => (e: ReactPointerEvent) => void
  onSelect: (s: Selection) => void
  onDraw: () => void
  dragging: boolean
}) {
  const { t } = useTranslation()
  const drop = dragging ? 'ring-1 ring-dashed ring-foreground/30' : ''
  const topOfTrash = side.trash.at(-1)
  // Mazzo, Vita, cestino e DON!! in un riquadro 2×2 accanto al campo: ogni lato sta su una riga
  // sola, così sul telefono in orizzontale le carte restano grandi.
  const pile = cn('relative h-[calc(var(--card-h)*0.48)] aspect-[63/88] rounded-md', drop)
  const badge =
    'absolute -top-1 -right-1 rounded-full bg-foreground px-1.5 text-[10px] font-bold text-background'
  const piles = (
    <div className="grid shrink-0 grid-cols-2 gap-1">
      <button
        type="button"
        onClick={onDraw}
        aria-label={t('playtest.deck', { count: side.deck.length })}
        className={pile}
        {...zoneProps(who, 'deckBottom')}
      >
        <CardBack className="h-full" label={t('playtest.deckShort')} />
        <span className={badge}>{side.deck.length}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          const top = side.life[0]
          if (top) onSelect({ kind: 'card', who, id: top.id })
        }}
        aria-label={t('playtest.life', { count: side.life.length })}
        className={pile}
        {...zoneProps(who, 'life')}
      >
        {side.life[0]?.faceUp ? (
          <CardFace card={side.life[0]} byCode={byCode} className="h-full" />
        ) : (
          <CardBack className="h-full bg-amber-700 bg-none" label={t('playtest.lifeShort')} />
        )}
        <span className={badge}>{side.life.length}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          onSelect({ kind: 'trash', who })
        }}
        aria-label={t('playtest.trash', { count: side.trash.length })}
        className={cn(
          pile,
          'flex items-center justify-center border border-dashed text-[9px] text-muted-foreground',
        )}
        {...zoneProps(who, 'trash')}
      >
        {topOfTrash ? (
          <CardFace card={topOfTrash} byCode={byCode} className="h-full opacity-70" />
        ) : (
          t('playtest.trashEmpty')
        )}
        <span className={badge}>{side.trash.length}</span>
      </button>
      <button
        type="button"
        onClick={() => {
          onSelect({ kind: 'don', who })
        }}
        aria-label={t('playtest.donLabel', {
          active: side.donActive,
          rested: side.donRested,
          deck: side.donDeck,
        })}
        className="flex aspect-[63/88] h-[calc(var(--card-h)*0.48)] flex-col items-center justify-center rounded-md border bg-violet-700/10 text-[10px] leading-tight"
      >
        <span className="font-semibold">{t('playtest.don')}</span>
        <span className="tabular-nums">
          {side.donActive}·{side.donRested}
        </span>
      </button>
    </div>
  )

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 items-center gap-2 px-2 [--card-h:min(25vh,11rem)]',
        flipped && 'flex-row-reverse',
      )}
    >
      <div
        className={cn(
          'flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-xl px-1',
          flipped && 'flex-row-reverse',
          drop,
        )}
        {...zoneProps(who, 'field')}
      >
        <FieldCard who={who} card={side.leader} byCode={byCode} startDrag={startDrag} leader />
        <div
          className={cn(
            'flex aspect-[63/88] h-[var(--card-h)] shrink-0 items-center justify-center rounded-md border border-dashed text-[9px] text-muted-foreground',
            drop,
          )}
          {...zoneProps(who, 'stage')}
        >
          {side.stage ? (
            <FieldCard who={who} card={side.stage} byCode={byCode} startDrag={startDrag} />
          ) : (
            t('playtest.stage')
          )}
        </div>
        <div
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1',
            flipped && 'flex-row-reverse',
          )}
        >
          {side.field.map((c) => (
            <FieldCard key={c.id} who={who} card={c} byCode={byCode} startDrag={startDrag} />
          ))}
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1">
        {piles}
        <span className="text-[10px] text-muted-foreground">
          {t('playtest.handCount', { count: side.hand.length })}
        </span>
      </div>
    </div>
  )
}
function FieldCard({
  who,
  card,
  byCode,
  startDrag,
  leader = false,
}: {
  who: PlayerId
  card: TableCard
  byCode: ReadonlyMap<string, CatalogCard>
  startDrag: (who: PlayerId, id: string, fromHand: boolean) => (e: ReactPointerEvent) => void
  leader?: boolean
}) {
  return (
    <div
      onPointerDown={startDrag(who, card.id, false)}
      className={cn(
        'relative shrink-0 touch-none transition-transform',
        card.rested && 'mx-[calc(var(--card-h)*0.15)] rotate-90',
        leader && 'rounded-md ring-2 ring-amber-500/70',
      )}
    >
      <CardFace card={card} byCode={byCode} className="h-[var(--card-h)]" />
      {card.don > 0 && (
        <span className="absolute -right-1 -bottom-1 rounded-full bg-violet-700 px-1.5 text-[10px] font-bold text-white">
          +{card.don}
        </span>
      )}
    </div>
  )
}

function Hand({
  who,
  side,
  byCode,
  startDrag,
  selected,
}: {
  who: PlayerId
  side: PlayerSide
  byCode: ReadonlyMap<string, CatalogCard>
  startDrag: (who: PlayerId, id: string, fromHand: boolean) => (e: ReactPointerEvent) => void
  selected: string | null
}) {
  const { t } = useTranslation()
  return (
    <div
      className="flex h-[24vh] shrink-0 [touch-action:pan-x] items-end gap-1 overflow-x-auto border-t bg-muted/30 px-2 pt-1 pb-[max(env(safe-area-inset-bottom),0.25rem)]"
      {...zoneProps(who, 'hand')}
    >
      <span className="shrink-0 rotate-180 self-center text-[10px] font-medium text-muted-foreground [writing-mode:vertical-rl]">
        {who === ME ? t('playtest.yourHand') : t('playtest.theirHand')}
      </span>
      {side.hand.map((c) => (
        <div
          key={c.id}
          onPointerDown={startDrag(who, c.id, true)}
          className={cn('shrink-0 transition-transform', selected === c.id && '-translate-y-2')}
        >
          <CardFace card={c} byCode={byCode} className="h-[22vh]" />
        </div>
      ))}
    </div>
  )
}

function SidePanel({
  game,
  setGame,
  byCode,
  selection,
  setSelection,
}: {
  game: Game
  setGame: (game: Game) => void
  byCode: ReadonlyMap<string, CatalogCard>
  selection: Selection
  setSelection: (s: Selection) => void
}) {
  const { t } = useTranslation()
  const act = (next: Game) => {
    setGame(next)
  }

  let body: React.ReactNode
  if (selection?.kind === 'card') {
    const found = findCard(game.players[selection.who], selection.id)
    if (!found) {
      body = null
    } else {
      const { zone, card } = found
      const who = selection.who
      const move = (to: Zone) => {
        act(moveCard(game, who, card.id, to))
        setSelection(null)
      }
      const actions: { label: string; run: () => void }[] = []
      if (zone === 'leader' || zone === 'field' || zone === 'stage') {
        actions.push({
          label: card.rested ? t('playtest.do.activate') : t('playtest.do.rest'),
          run: () => {
            act(toggleRest(game, who, card.id))
          },
        })
      }
      if (zone === 'leader' || zone === 'field') {
        actions.push(
          {
            label: t('playtest.do.giveDon'),
            run: () => {
              act(giveDon(game, who, card.id))
            },
          },
          {
            label: t('playtest.do.takeDon'),
            run: () => {
              act(takeDon(game, who, card.id))
            },
          },
        )
      }
      if (zone === 'hand') {
        actions.push(
          {
            label: t('playtest.do.play'),
            run: () => {
              move('field')
            },
          },
          {
            label: t('playtest.do.stage'),
            run: () => {
              move('stage')
            },
          },
        )
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
              act(flipLife(game, who, card.id))
            },
          },
        )
      }
      if (zone === 'trash') {
        actions.push({
          label: t('playtest.do.play'),
          run: () => {
            move('field')
          },
        })
      }
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
          <CardFace card={card} byCode={byCode} className="mx-auto h-[42vh]" />
          <Actions actions={actions} />
        </>
      )
    }
  } else if (selection?.kind === 'don') {
    const who = selection.who
    const don = (action: DonAction) => {
      act(changeDon(game, who, action))
    }
    body = (
      <>
        <p className="text-sm font-semibold">{t('playtest.don')}</p>
        <Actions
          actions={[
            {
              label: t('playtest.do.donRest'),
              run: () => {
                don('rest')
              },
            },
            {
              label: t('playtest.do.donActivate'),
              run: () => {
                don('activate')
              },
            },
            {
              label: t('playtest.do.donAdd'),
              run: () => {
                don('add')
              },
            },
            {
              label: t('playtest.do.donReturn'),
              run: () => {
                don('return')
              },
            },
          ]}
        />
      </>
    )
  } else if (selection?.kind === 'trash') {
    const side = game.players[selection.who]
    body = (
      <>
        <p className="text-sm font-semibold">{t('playtest.trash', { count: side.trash.length })}</p>
        <div className="grid grid-cols-2 gap-1">
          {[...side.trash].reverse().map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setSelection({ kind: 'card', who: selection.who, id: c.id })
              }}
            >
              <CardFace card={c} byCode={byCode} className="w-full" />
            </button>
          ))}
        </div>
      </>
    )
  } else {
    const who = game.active
    body = (
      <Actions
        actions={[
          {
            label: t('playtest.do.endTurn'),
            run: () => {
              act(nextTurn(game))
            },
          },
          {
            label: t('playtest.do.draw'),
            run: () => {
              act(draw(game, who))
            },
          },
          {
            label: t('playtest.do.shuffle'),
            run: () => {
              act(shuffleDeck(game, who, random))
            },
          },
        ]}
      />
    )
  }

  return (
    <aside className="flex w-[clamp(9rem,22vw,15rem)] shrink-0 flex-col gap-2 overflow-y-auto border-l p-2">
      <div className="flex items-center gap-1">
        {selection ? (
          <button
            type="button"
            onClick={() => {
              setSelection(null)
            }}
            className="inline-flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs"
          >
            <X className="size-3.5" aria-hidden="true" />
            {t('playtest.close')}
          </button>
        ) : (
          <Link
            to={DECKS_PATH}
            className="inline-flex h-8 items-center rounded-full border px-2.5 text-xs"
          >
            {t('playtest.exit')}
          </Link>
        )}
      </div>
      {body}
    </aside>
  )
}

function Actions({ actions }: { actions: { label: string; run: () => void }[] }) {
  return (
    <div className="flex flex-col gap-1">
      {actions.map((a) => (
        <button
          key={a.label}
          type="button"
          onClick={a.run}
          className="min-h-9 rounded-xl border px-3 py-1.5 text-left text-xs font-medium hover:bg-muted"
        >
          {a.label}
        </button>
      ))}
    </div>
  )
}
