import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { useCatalog } from '@/catalog/local-catalog'
import { DECKS_PATH } from '@/decks/paths'
import { DeckChooser } from './DeckChooser'
import { mulligan, newGame, startGame, type Game, type PlayerId } from './game'
import { MulliganDialog } from './MulliganDialog'
import { PLAYTEST_DECK_PARAM } from './paths'
import { Table } from './Table'
import type { TableDeck } from './table-decks'
import { clearSavedGame, loadSavedGame, saveGame, type SavedGame } from './saved-game'
import { RotateHint } from './table-parts'
import { useTableDecks } from './use-table-decks'

// Playtest Table in solitario (RIB-99, ADR-0011): scelta dei mazzi "VS", mulligan di entrambi i
// lati, poi il tavolo. A tutto schermo, in orizzontale. La partita si salva sul dispositivo a ogni
// mossa e si riprende riaprendo il tavolo (RIB-103).

const random = () => Math.random()

type Stage =
  | { kind: 'choose' }
  | { kind: 'mulligan'; game: Game; who: PlayerId; decks: [TableDeck, TableDeck] }
  | { kind: 'play'; game: Game; decks: [TableDeck, TableDeck] }

export function PlaytestPage() {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const cards = catalog?.cards ?? null
  const byCode = useMemo(() => new Map((cards ?? []).map((c) => [c.cardCode, c])), [cards])
  const { decks, loading } = useTableDecks(cards)
  const [params] = useSearchParams()
  const [stage, setStage] = useState<Stage>({ kind: 'choose' })
  const [saved, setSaved] = useState<SavedGame | null>(() => loadSavedGame())

  useEffect(() => {
    if (stage.kind === 'play') saveGame(stage.game, stage.decks)
  }, [stage])

  let content
  if (loading) {
    content = <p className="p-6 text-muted-foreground">{t('playtest.loading')}</p>
  } else if (saved && stage.kind === 'choose') {
    content = (
      <ResumeGame
        saved={saved}
        onResume={() => {
          setStage({ kind: 'play', game: saved.game, decks: saved.decks })
          setSaved(null)
        }}
        onDiscard={() => {
          clearSavedGame()
          setSaved(null)
        }}
      />
    )
  } else if (decks.length === 0) {
    content = (
      <div className="space-y-3 p-6">
        <p>{t('playtest.noDecks')}</p>
        <Link to={DECKS_PATH} className="text-sm underline underline-offset-2">
          {t('playtest.exit')}
        </Link>
      </div>
    )
  } else if (stage.kind === 'choose') {
    content = (
      <DeckChooser
        decks={decks}
        byCode={byCode}
        preselected={params.get(PLAYTEST_DECK_PARAM)}
        onStart={(mine, theirs, first) => {
          setStage({
            kind: 'mulligan',
            game: newGame([mine.list, theirs.list], first, random),
            who: 0,
            decks: [mine, theirs],
          })
        }}
      />
    )
  } else {
    const { game } = stage
    const setGame = (next: Game) => {
      if (stage.kind === 'play') setStage({ ...stage, game: next })
    }
    content = (
      <>
        <Table
          game={game}
          setGame={setGame}
          byCode={byCode}
          onNewGame={() => {
            clearSavedGame()
            setStage({ kind: 'choose' })
          }}
        />
        {stage.kind === 'mulligan' && (
          <MulliganDialog
            key={stage.who}
            title={
              stage.who === 1
                ? t('playtest.opponentMulligan')
                : game.first === 0
                  ? t('playtest.youStart')
                  : t('playtest.opponentStarts')
            }
            hand={game.players[stage.who].hand}
            canRedraw={!game.players[stage.who].mulliganUsed}
            byCode={byCode}
            onRedraw={() => {
              setStage({ ...stage, game: mulligan(game, stage.who, random) })
            }}
            onKeep={() => {
              if (stage.who === 0) {
                setStage({ ...stage, who: 1 })
                return
              }
              const lives: [number, number] = [
                stage.decks[0].list.leader.life,
                stage.decks[1].list.leader.life,
              ]
              setStage({ kind: 'play', game: startGame(game, lives), decks: stage.decks })
            }}
          />
        )}
      </>
    )
  }

  return (
    <div className="[container-type:size] fixed inset-0 z-50 bg-background text-foreground">
      {content}
      <RotateHint />
    </div>
  )
}

/** Riaprendo il tavolo con una partita salvata: riprenderla o cominciarne una nuova. */
function ResumeGame({
  saved,
  onResume,
  onDiscard,
}: {
  saved: SavedGame
  onResume: () => void
  onDiscard: () => void
}) {
  const { t, i18n } = useTranslation()
  const when = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(saved.savedAt))
  return (
    <div className="flex h-full items-center justify-center p-4">
      <section
        role="dialog"
        aria-label={t('playtest.resume.title')}
        className="max-w-md space-y-4 rounded-2xl border bg-background p-5 text-center shadow-xl"
      >
        <h1 className="text-xl font-semibold">{t('playtest.resume.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('playtest.resume.text', {
            turn: saved.game.turn,
            mine: saved.decks[0].name,
            theirs: saved.decks[1].name,
            when,
          })}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onDiscard}
            className="h-11 rounded-full border px-5 font-medium hover:bg-muted"
          >
            {t('playtest.resume.discard')}
          </button>
          <button
            type="button"
            onClick={onResume}
            className="h-11 rounded-full bg-foreground px-5 font-semibold text-background"
          >
            {t('playtest.resume.resume')}
          </button>
        </div>
      </section>
    </div>
  )
}
