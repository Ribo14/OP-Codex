import { X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { DECKS_PATH } from '@/decks/paths'
import { cn } from '@/lib/utils'
import type { PlayerId } from './game'
import { deckCount, type TableDeck } from './table-decks'
import { CardFace, type ByCode } from './table-parts'

// Scelta dei mazzi in stile "VS" (RIB-99): a sinistra il proprio mazzo, a destra quello
// dell'avversario, ognuno col suo Leader; poi chi inizia e "Inizia la battaglia".

const FIRST_OPTIONS = ['random', 'me', 'opponent'] as const
type First = (typeof FIRST_OPTIONS)[number]

export function DeckChooser({
  decks,
  byCode,
  preselected,
  onStart,
}: {
  decks: readonly TableDeck[]
  byCode: ByCode
  /** Deck dell'utente da cui si arriva ("Prova sul tavolo"). */
  preselected: string | null
  onStart: (mine: TableDeck, theirs: TableDeck, first: PlayerId) => void
}) {
  const { t } = useTranslation()
  const starters = decks.filter((d) => d.kind === 'starter')
  const [mineId, setMineId] = useState(
    () => decks.find((d) => d.id === preselected)?.id ?? decks[0]?.id ?? '',
  )
  const [theirsId, setTheirsId] = useState(
    // Uno Starter diverso dal proprio mazzo; con un mazzo solo, lo stesso per entrambi.
    () =>
      (starters.find((d) => d.id !== mineId) ?? decks.find((d) => d.id !== mineId) ?? decks[0])
        ?.id ?? '',
  )
  const [first, setFirst] = useState<First>('random')
  const mine = decks.find((d) => d.id === mineId)
  const theirs = decks.find((d) => d.id === theirsId)

  return (
    <div className="flex h-full flex-col gap-[2cqh] overflow-y-auto px-4 py-[3cqh]">
      <div className="flex items-center gap-3">
        <Link
          to={DECKS_PATH}
          aria-label={t('playtest.exit')}
          className="inline-flex size-9 items-center justify-center rounded-full border hover:bg-muted"
        >
          <X className="size-5" aria-hidden="true" />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{t('playtest.title')}</h1>
        <p className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground md:block">
          {t('playtest.intro')}
        </p>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-[4cqw]">
        <DeckSide
          label={t('playtest.myDeck')}
          deck={mine}
          decks={decks}
          byCode={byCode}
          onChange={setMineId}
          tone="me"
        />
        <span
          aria-hidden="true"
          className="text-[12cqh] leading-none font-black text-muted-foreground/60 italic"
        >
          VS
        </span>
        <DeckSide
          label={t('playtest.opponentDeck')}
          deck={theirs}
          decks={decks}
          byCode={byCode}
          onChange={setTheirsId}
          tone="opponent"
        />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <div
          role="radiogroup"
          aria-label={t('playtest.whoStarts')}
          className="flex items-center gap-1 rounded-full bg-muted p-1 text-sm"
        >
          <span className="px-2 text-xs text-muted-foreground">{t('playtest.whoStarts')}</span>
          {FIRST_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={first === option}
              onClick={() => {
                setFirst(option)
              }}
              className={cn(
                'h-8 rounded-full px-3 font-medium',
                first === option ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              {t(`playtest.first.${option}`)}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={!mine || !theirs}
          onClick={() => {
            if (!mine || !theirs) return
            const who: PlayerId =
              first === 'me' ? 0 : first === 'opponent' ? 1 : Math.random() < 0.5 ? 0 : 1
            onStart(mine, theirs, who)
          }}
          className="h-11 rounded-full bg-foreground px-6 font-semibold text-background disabled:opacity-50"
        >
          {t('playtest.start')}
        </button>
      </div>
    </div>
  )
}

function DeckSide({
  label,
  deck,
  decks,
  byCode,
  onChange,
  tone,
}: {
  label: string
  deck: TableDeck | undefined
  decks: readonly TableDeck[]
  byCode: ByCode
  onChange: (id: string) => void
  tone: 'me' | 'opponent'
}) {
  const { t } = useTranslation()
  const own = decks.filter((d) => d.kind === 'own')
  const starters = decks.filter((d) => d.kind === 'starter')
  return (
    <section
      aria-label={label}
      className={cn(
        'flex w-[min(36cqw,22rem)] flex-col items-center gap-2 rounded-2xl border-2 p-3',
        tone === 'me' ? 'border-sky-600/50 bg-sky-600/5' : 'border-red-600/50 bg-red-600/5',
      )}
    >
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      {/* CardThumb si allinea da sé in cima (self-start): il contenitore la centra. */}
      {deck ? (
        <div className="flex justify-center">
          <CardFace
            cardCode={deck.list.leader.cardCode}
            printId={deck.list.leader.printId}
            byCode={byCode}
            className="h-[38cqh] rounded-lg shadow-lg"
          />
        </div>
      ) : (
        <div className="aspect-[63/88] h-[38cqh] rounded-lg bg-muted" />
      )}
      <select
        aria-label={`${label}: ${t('playtest.chooseDeck')}`}
        value={deck?.id ?? ''}
        onChange={(e) => {
          onChange(e.target.value)
        }}
        className="h-10 w-full truncate rounded-xl border bg-background px-3 text-sm font-medium"
      >
        {own.length > 0 && (
          <optgroup label={t('playtest.ownDecks')}>
            {own.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label={t('playtest.starterDecks')}>
          {starters.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </optgroup>
      </select>
      {deck && (
        <p className="text-xs text-muted-foreground">
          {t('playtest.cards', { count: deckCount(deck) })}
        </p>
      )}
    </section>
  )
}
