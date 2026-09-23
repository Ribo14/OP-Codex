// PROTOTIPO RIB-8 — Variante A "Galleria": le carte grandi in primo piano, interfaccia che si fa da parte.
import { Search, X } from 'lucide-react'
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
import { CardImage, ColorDots, NAV_ITEMS, statLine, ThemeButton, COLOR_LABELS } from './shared'

export const variantName = 'Galleria'

export function VariantA() {
  const sets = useLoad('sets', fetchSets)
  const [seriesId, setSeriesId] = useState(DEFAULT_SERIES_ID)
  const cards = useLoad(`set-${String(seriesId)}`, () => fetchSetCards(seriesId))
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<ProtoCard | null>(null)
  useInitialCard(cards, setOpen)

  const visible = useMemo(() => {
    if (cards.status !== 'ready') return []
    const q = query.trim().toLowerCase()
    return q ? cards.data.filter((c) => c.name.toLowerCase().includes(q)) : cards.data
  }, [cards, query])

  return (
    <div className="proto-a min-h-svh bg-background pb-24 text-foreground lg:pb-10">
      {/* Barra in alto: su desktop contiene anche la navigazione */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-4 px-4 lg:h-16 lg:px-8">
          <span className="shrink-0 text-lg font-semibold tracking-tight whitespace-nowrap">
            OP-Codex
          </span>
          <nav className="ml-6 hidden items-center gap-1 lg:flex" aria-label="Sezioni">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                type="button"
                disabled={!item.ready}
                title={item.ready ? undefined : 'In arrivo'}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm transition',
                  item.ready
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground disabled:opacity-60',
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
          <label className="ml-auto flex h-9 w-full max-w-xs items-center gap-2 rounded-full bg-muted px-3 text-sm">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              placeholder="Cerca una carta"
              className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
            />
          </label>
          <ThemeButton />
        </div>

        {/* Set come fila di chip scorrevole */}
        <div className="mx-auto flex max-w-[1600px] gap-2 overflow-x-auto px-4 pb-3 lg:px-8 [&::-webkit-scrollbar]:hidden">
          {sets.status === 'ready' &&
            sets.data.map((s) => (
              <button
                key={s.seriesId}
                type="button"
                onClick={() => {
                  setSeriesId(s.seriesId)
                }}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition',
                  s.seriesId === seriesId
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                )}
              >
                {s.code}
              </button>
            ))}
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 pt-6 lg:px-8">
        {sets.status === 'ready' && (
          <h1 className="mb-6 text-2xl font-semibold tracking-tight lg:text-3xl">
            {sets.data.find((s) => s.seriesId === seriesId)?.name}
            <span className="ml-3 align-middle text-sm font-normal text-muted-foreground">
              {visible.length} carte
            </span>
          </h1>
        )}
        {cards.status === 'loading' && <p className="text-muted-foreground">Caricamento…</p>}
        {cards.status === 'error' && <p role="alert">{cards.message}</p>}
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-6 2xl:grid-cols-6">
          {visible.map((card) => (
            <li key={card.cardCode}>
              <button
                type="button"
                onClick={() => {
                  setOpen(card)
                }}
                className="group block w-full text-left focus-visible:outline-none"
              >
                <CardImage
                  printId={card.printId}
                  name={card.name}
                  hasImage={card.hasImage}
                  className="rounded-xl shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-xl group-focus-visible:ring-2 group-focus-visible:ring-ring"
                />
                <span className="mt-2 block truncate text-sm font-medium">{card.name}</span>
                <span className="block text-xs text-muted-foreground">{card.cardCode}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>

      {/* Telefono: barra in basso */}
      <nav
        aria-label="Sezioni"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border/60 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={!item.ready}
            className={cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px]',
              item.ready ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <item.icon className="size-5" strokeWidth={item.ready ? 2.25 : 1.75} />
            {item.label}
          </button>
        ))}
      </nav>

      {open && (
        <Detail
          card={open}
          onClose={() => {
            setOpen(null)
          }}
        />
      )}
    </div>
  )
}

function Detail({ card, onClose }: { card: ProtoCard; onClose: () => void }) {
  const printings = useLoad(`p-${card.cardCode}`, () => fetchCardPrintings(card.cardCode))
  const [selected, setSelected] = useState(card.printId)
  const current =
    printings.status === 'ready' ? printings.data.find((p) => p.printId === selected) : undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={card.name}
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center lg:p-8"
      onClick={onClose}
    >
      <div
        className="relative flex h-full w-full flex-col overflow-y-auto bg-background lg:h-auto lg:max-h-[90vh] lg:max-w-5xl lg:flex-row lg:rounded-3xl lg:shadow-2xl"
        onClick={(e) => {
          e.stopPropagation()
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="absolute top-3 right-3 z-10 inline-flex size-9 items-center justify-center rounded-full bg-background/80 backdrop-blur"
        >
          <X className="size-5" />
        </button>

        <div className="bg-muted/50 p-6 lg:w-[45%] lg:p-10">
          <CardImage
            printId={selected}
            name={card.name}
            hasImage={current?.hasImage ?? card.hasImage}
            variant="full"
            className="mx-auto max-w-sm rounded-2xl shadow-2xl"
          />
          {printings.status === 'ready' && printings.data.length > 1 && (
            <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
              {printings.data.map((p) => (
                <button
                  key={p.printId}
                  type="button"
                  onClick={() => {
                    setSelected(p.printId)
                  }}
                  title={`${p.printId} · ${p.setCode}`}
                  className={cn(
                    'w-14 shrink-0 overflow-hidden rounded-md ring-2 transition',
                    p.printId === selected
                      ? 'ring-foreground'
                      : 'opacity-70 ring-transparent hover:opacity-100',
                  )}
                >
                  <CardImage printId={p.printId} name={p.printId} hasImage={p.hasImage} />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-6 p-6 lg:p-10">
          <div>
            <p className="text-sm text-muted-foreground">
              {card.cardCode} · {card.category} · {current?.rarity ?? card.rarity}
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight">{card.name}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {card.colors.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs"
                >
                  <ColorDots colors={[c]} /> {COLOR_LABELS[c] ?? c}
                </span>
              ))}
              {card.types.map((t) => (
                <span
                  key={t}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {statLine(card).map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {card.effect && (
            <section>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Effetto</h3>
              <p className="leading-relaxed whitespace-pre-line">{card.effect}</p>
            </section>
          )}
          {card.trigger && (
            <section>
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">Trigger</h3>
              <p className="leading-relaxed">{card.trigger}</p>
            </section>
          )}
          {current && (
            <p className="text-xs text-muted-foreground">
              Printing {current.printId} · {current.setCode} {current.setName}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
