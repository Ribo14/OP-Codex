// PROTOTIPO RIB-8 — Variante C "Raccoglitore": impaginazione editoriale, carte per Category, dettaglio come pagina.
import { ArrowLeft } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  DEFAULT_SERIES_ID,
  fetchCardPrintings,
  fetchSetCards,
  fetchSets,
  useInitialCard,
  useLoad,
  type ProtoCard,
} from './data'
import {
  CardImage,
  COLOR_LABELS,
  GAME_COLORS,
  NAV_ITEMS,
  ThemeButton,
  colorGradient,
  statLine,
} from './shared'

export const variantName = 'Raccoglitore'

const CATEGORY_ORDER = ['Leader', 'Character', 'Event', 'Stage', 'DON!!']
const CATEGORY_LABELS: Record<string, string> = {
  Leader: 'Leader',
  Character: 'Personaggi',
  Event: 'Eventi',
  Stage: 'Luoghi',
  'DON!!': 'DON!!',
}

export function VariantC() {
  const sets = useLoad('sets', fetchSets)
  const [seriesId, setSeriesId] = useState(DEFAULT_SERIES_ID)
  const cards = useLoad(`set-${String(seriesId)}`, () => fetchSetCards(seriesId))
  const [open, setOpen] = useState<ProtoCard | null>(null)
  useInitialCard(cards, setOpen)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [open])

  const groups = useMemo(() => {
    if (cards.status !== 'ready') return []
    return CATEGORY_ORDER.map((cat) => ({
      cat,
      cards: cards.data.filter((c) => c.category === cat),
    })).filter((g) => g.cards.length > 0)
  }, [cards])

  const currentSet =
    sets.status === 'ready' ? sets.data.find((s) => s.seriesId === seriesId) : undefined

  return (
    <div className="proto-c min-h-svh bg-background pb-28 text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-5 pt-5 lg:px-10">
          <span className="font-serif text-2xl font-semibold tracking-tight italic">OP-Codex</span>
          <ThemeButton className="ml-auto" />
        </div>
        {/* Desktop: schede sottolineate */}
        <nav className="mx-auto hidden max-w-6xl gap-8 px-10 lg:flex" aria-label="Sezioni">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={!item.ready}
              className={cn(
                'border-b-2 py-4 text-sm',
                item.ready
                  ? 'border-foreground font-medium'
                  : 'border-transparent text-muted-foreground disabled:opacity-70',
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <div className="h-4 lg:hidden" />
      </header>

      {open ? (
        <DetailPage
          card={open}
          setCode={currentSet?.code ?? ''}
          onBack={() => {
            setOpen(null)
          }}
        />
      ) : (
        <main className="mx-auto max-w-6xl px-5 lg:px-10">
          {/* Intestazione del Set */}
          <section className="py-8 lg:py-12">
            <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
              {currentSet?.productType ?? 'Set'}
            </p>
            <div className="mt-2 flex flex-wrap items-end gap-x-6 gap-y-3">
              <h1 className="font-serif text-5xl font-semibold tracking-tight lg:text-7xl">
                {currentSet?.code}
              </h1>
              <p className="pb-2 font-serif text-xl text-muted-foreground lg:text-2xl">
                {currentSet?.name}
              </p>
            </div>
            <label className="mt-5 inline-flex items-center gap-2 text-sm">
              Cambia Set
              <select
                value={seriesId}
                onChange={(e) => {
                  setSeriesId(Number(e.target.value))
                }}
                className="rounded-full border bg-background px-3 py-1.5"
              >
                {sets.status === 'ready' &&
                  sets.data.map((s) => (
                    <option key={s.seriesId} value={s.seriesId}>
                      {s.code} · {s.name}
                    </option>
                  ))}
              </select>
            </label>
          </section>

          {cards.status === 'loading' && <p className="text-muted-foreground">Caricamento…</p>}
          {groups.map((g) => (
            <section key={g.cat} className="mb-12">
              <h2 className="mb-5 flex items-baseline gap-3 border-b pb-2 font-serif text-2xl">
                {CATEGORY_LABELS[g.cat] ?? g.cat}
                <span className="font-sans text-sm text-muted-foreground">{g.cards.length}</span>
              </h2>
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6 lg:gap-5">
                {g.cards.map((card) => (
                  <li key={card.cardCode}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(card)
                      }}
                      className="group block w-full rounded-lg bg-card p-1.5 text-left shadow-sm ring-1 ring-border transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <span
                        className="mb-1.5 block h-1 rounded-full"
                        style={{ background: colorGradient(card.colors) }}
                      />
                      <CardImage
                        printId={card.printId}
                        name={card.name}
                        hasImage={card.hasImage}
                        className="rounded-md"
                      />
                      <span className="mt-1.5 block truncate px-0.5 font-serif text-sm">
                        {card.name}
                      </span>
                      <span className="block px-0.5 text-[11px] text-muted-foreground">
                        {card.cardCode}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </main>
      )}

      {/* Telefono: pillola flottante */}
      <nav
        aria-label="Sezioni"
        className="fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom)+12px)] z-30 flex justify-around rounded-full border bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur lg:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={!item.ready}
            aria-label={item.label}
            className={cn(
              'inline-flex size-11 items-center justify-center rounded-full',
              item.ready ? 'bg-foreground text-background' : 'text-muted-foreground',
            )}
          >
            <item.icon className="size-5" />
          </button>
        ))}
      </nav>
    </div>
  )
}

function DetailPage({
  card,
  setCode,
  onBack,
}: {
  card: ProtoCard
  setCode: string
  onBack: () => void
}) {
  const printings = useLoad(`p-${card.cardCode}`, () => fetchCardPrintings(card.cardCode))
  const [selected, setSelected] = useState(card.printId)
  const current =
    printings.status === 'ready' ? printings.data.find((p) => p.printId === selected) : undefined
  const accent = GAME_COLORS[card.colors[0] ?? ''] ?? '#888'

  return (
    <main className="mx-auto max-w-6xl px-5 py-6 lg:px-10 lg:py-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {setCode}
      </button>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr] lg:gap-14">
        <div className="lg:sticky lg:top-6 lg:self-start">
          <CardImage
            printId={selected}
            name={card.name}
            hasImage={current?.hasImage ?? card.hasImage}
            variant="full"
            className="mx-auto max-w-[360px] rounded-2xl shadow-xl lg:max-w-none"
          />
        </div>

        <div>
          <p className="text-xs tracking-[0.2em] text-muted-foreground uppercase">
            {card.category} · {card.cardCode}
          </p>
          <h1 className="mt-2 font-serif text-4xl font-semibold tracking-tight lg:text-5xl">
            {card.name}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {card.colors.map((c) => COLOR_LABELS[c] ?? c).join(' / ')} · {card.types.join(' / ')}
          </p>

          <dl className="mt-8 grid grid-cols-2 border-y sm:grid-cols-4">
            {statLine(card).map(([label, value]) => (
              <div
                key={label}
                className="border-r py-4 pr-4 last:border-r-0 sm:[&:not(:first-child)]:pl-4"
              >
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="font-serif text-3xl tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {card.effect && (
            <section
              className="mt-8 rounded-r-lg border-l-4 bg-muted/40 p-5"
              style={{ borderColor: accent }}
            >
              <h2 className="mb-2 font-serif text-lg">Effetto</h2>
              <p className="leading-relaxed whitespace-pre-line">{card.effect}</p>
            </section>
          )}
          {card.trigger && (
            <section className="mt-4 rounded-r-lg border-l-4 border-yellow-500 bg-muted/40 p-5">
              <h2 className="mb-2 font-serif text-lg">Trigger</h2>
              <p className="leading-relaxed">{card.trigger}</p>
            </section>
          )}

          <section className="mt-10">
            <h2 className="mb-4 font-serif text-2xl">Tutte le Printing</h2>
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {printings.status === 'ready' &&
                printings.data.map((p) => (
                  <li key={p.printId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(p.printId)
                      }}
                      className={cn(
                        'block w-full rounded-lg p-1 text-left ring-1 transition',
                        p.printId === selected
                          ? 'ring-2 ring-foreground'
                          : 'ring-border hover:ring-foreground/40',
                      )}
                    >
                      <CardImage
                        printId={p.printId}
                        name={p.printId}
                        hasImage={p.hasImage}
                        className="rounded"
                      />
                      <span className="mt-1 block truncate text-[11px] font-medium">
                        {p.setCode}
                      </span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {p.printId} · {p.rarity}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        </div>
      </div>
    </main>
  )
}
