// PROTOTIPO RIB-8 — Variante D "Sintesi": stile neutro di A, barra laterale su desktop (B),
// catalogo con interruttore Griglia/Elenco (A + B), dettaglio a tutto schermo su telefono
// e affiancato su desktop.
import { LayoutGrid, List, Search, X } from 'lucide-react'
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
  ColorDots,
  NAV_ITEMS,
  ThemeButton,
  colorGradient,
  statLine,
} from './shared'

export const variantName = 'Sintesi'

type View = 'grid' | 'list'

function readView(): View {
  const param = new URLSearchParams(window.location.search).get('view')
  if (param === 'list' || param === 'grid') return param
  try {
    return localStorage.getItem('proto-d-view') === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export function VariantD() {
  const sets = useLoad('sets', fetchSets)
  const [seriesId, setSeriesId] = useState(DEFAULT_SERIES_ID)
  const cards = useLoad(`set-${String(seriesId)}`, () => fetchSetCards(seriesId))
  const [query, setQuery] = useState('')
  const [view, setViewState] = useState<View>(readView)
  const [open, setOpen] = useState<ProtoCard | null>(null)
  useInitialCard(cards, setOpen)

  const setView = (v: View) => {
    setViewState(v)
    try {
      localStorage.setItem('proto-d-view', v)
    } catch {
      /* storage non disponibile */
    }
  }

  const visible = useMemo(() => {
    if (cards.status !== 'ready') return []
    const q = query.trim().toLowerCase()
    return q
      ? cards.data.filter(
          (c) => c.name.toLowerCase().includes(q) || c.cardCode.toLowerCase().includes(q),
        )
      : cards.data
  }, [cards, query])

  const currentSet =
    sets.status === 'ready' ? sets.data.find((s) => s.seriesId === seriesId) : undefined

  return (
    <div className="proto-a flex h-svh bg-background text-foreground">
      {/* Desktop: barra laterale */}
      <aside className="hidden w-60 shrink-0 flex-col border-r lg:flex">
        <div className="px-6 py-6 text-lg font-semibold tracking-tight">OP-Codex</div>
        <nav className="flex flex-col gap-1 px-3" aria-label="Sezioni">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={!item.ready}
              title={item.ready ? undefined : 'In arrivo'}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition',
                item.ready
                  ? 'bg-foreground font-medium text-background'
                  : 'text-muted-foreground hover:bg-muted disabled:opacity-70',
              )}
            >
              <item.icon className="size-[18px]" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between px-6 py-5 text-sm text-muted-foreground">
          Tema
          <ThemeButton />
        </div>
      </aside>

      {/* Contenuto */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border/60">
          <div className="flex h-14 items-center gap-3 px-4 lg:h-16 lg:px-8">
            <span className="shrink-0 text-lg font-semibold tracking-tight whitespace-nowrap lg:hidden">
              OP-Codex
            </span>
            <label className="flex h-9 w-full max-w-md items-center gap-2 rounded-full bg-muted px-3 text-sm lg:max-w-lg">
              <Search className="size-4 shrink-0 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                }}
                placeholder="Cerca per nome o codice"
                className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
              />
            </label>
            <ThemeButton className="ml-auto lg:hidden" />
          </div>
          <div className="flex gap-2 overflow-x-auto px-4 pb-3 lg:px-8 [&::-webkit-scrollbar]:hidden">
            {sets.status === 'ready' &&
              sets.data.map((s) => (
                <button
                  key={s.seriesId}
                  type="button"
                  onClick={() => {
                    setSeriesId(s.seriesId)
                    setOpen(null)
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

        <div className="flex min-h-0 flex-1">
          <main className="min-w-0 flex-1 overflow-y-auto px-4 pt-5 pb-28 lg:px-8 lg:pb-10">
            <div className="mb-5 flex items-end gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {currentSet?.code} · {visible.length} carte
                </p>
                <h1 className="truncate text-2xl font-semibold tracking-tight lg:text-3xl">
                  {currentSet?.name}
                </h1>
              </div>
              {/* Interruttore Griglia / Elenco */}
              <div
                role="group"
                aria-label="Vista"
                className="ml-auto flex shrink-0 rounded-full bg-muted p-1"
              >
                {(
                  [
                    ['grid', 'Griglia', LayoutGrid],
                    ['list', 'Elenco', List],
                  ] as const
                ).map(([key, label, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={view === key}
                    onClick={() => {
                      setView(key)
                    }}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition',
                      view === key ? 'bg-background shadow-sm' : 'text-muted-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {cards.status === 'loading' && <p className="text-muted-foreground">Caricamento…</p>}

            {view === 'grid' ? (
              <ul
                className={cn(
                  'grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6',
                  open ? 'xl:grid-cols-4 2xl:grid-cols-5' : 'lg:grid-cols-5 2xl:grid-cols-6',
                )}
              >
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
                        className={cn(
                          'rounded-xl shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-xl group-focus-visible:ring-2 group-focus-visible:ring-ring',
                          open?.cardCode === card.cardCode && 'ring-2 ring-foreground',
                        )}
                      />
                      <span className="mt-2 block truncate text-sm font-medium">{card.name}</span>
                      <span className="block text-xs text-muted-foreground">{card.cardCode}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="overflow-hidden rounded-2xl border">
                {visible.map((card) => (
                  <li key={card.cardCode} className="border-b last:border-0">
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(card)
                      }}
                      className={cn(
                        'grid w-full grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none md:grid-cols-[2.5rem_6rem_1fr_7rem_3.5rem_4.5rem_4.5rem_3rem]',
                        open &&
                          'lg:grid-cols-[2.5rem_1fr_3.5rem_4.5rem_4.5rem_3rem] lg:[&>.col-extra]:hidden',
                        open?.cardCode === card.cardCode && 'bg-muted',
                      )}
                    >
                      <span className="relative overflow-hidden rounded-md">
                        <CardImage
                          printId={card.printId}
                          name={card.name}
                          hasImage={card.hasImage}
                        />
                        <span
                          className="absolute inset-x-0 bottom-0 h-1"
                          style={{ background: colorGradient(card.colors) }}
                        />
                      </span>
                      <span className="col-extra hidden text-xs text-muted-foreground tabular-nums md:block">
                        {card.cardCode}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{card.name}</span>
                        <span className="flex items-center gap-2 text-xs text-muted-foreground md:hidden">
                          {card.cardCode} <ColorDots colors={card.colors} />
                          {card.cost !== null && <span>Costo {card.cost}</span>}
                          {card.power !== null && <span>{card.power}</span>}
                        </span>
                      </span>
                      <span className="col-extra hidden items-center gap-2 text-xs md:flex">
                        <ColorDots colors={card.colors} /> {card.category}
                      </span>
                      <span className="hidden text-right tabular-nums md:block">
                        {card.cost ?? card.life ?? '–'}
                      </span>
                      <span className="hidden text-right tabular-nums md:block">
                        {card.power ?? '–'}
                      </span>
                      <span className="hidden text-right tabular-nums md:block">
                        {card.counter !== null ? `+${String(card.counter)}` : '–'}
                      </span>
                      <span className="text-right text-xs text-muted-foreground">
                        {card.rarity}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </main>

          {/* Dettaglio: a tutto schermo su telefono, affiancato su desktop (stesso elemento) */}
          {open && (
            <aside
              aria-label={open.name}
              className="fixed inset-0 z-40 overflow-y-auto bg-background lg:static lg:z-auto lg:w-[440px] lg:shrink-0 lg:border-l"
            >
              <Detail
                key={open.cardCode}
                card={open}
                onClose={() => {
                  setOpen(null)
                }}
              />
            </aside>
          )}
        </div>
      </div>

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
    <div className="pb-10">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-background/90 px-4 py-3 backdrop-blur lg:px-6">
        <span className="truncate text-sm text-muted-foreground">
          {card.cardCode} · {card.category} · {current?.rarity ?? card.rarity}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="bg-muted/40 px-6 py-6">
        <CardImage
          printId={selected}
          name={card.name}
          hasImage={current?.hasImage ?? card.hasImage}
          variant="full"
          className="mx-auto max-w-[320px] rounded-2xl shadow-2xl"
        />
        {printings.status === 'ready' && printings.data.length > 1 && (
          <div className="mt-5 flex justify-center gap-2 overflow-x-auto pb-1">
            {printings.data.map((p) => (
              <button
                key={p.printId}
                type="button"
                onClick={() => {
                  setSelected(p.printId)
                }}
                title={`${p.printId} · ${p.setCode}`}
                className={cn(
                  'w-12 shrink-0 overflow-hidden rounded-md ring-2 transition',
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

      <div className="space-y-6 px-6 pt-6">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{card.name}</h2>
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

        <dl className="grid grid-cols-3 gap-2">
          {statLine(card).map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{value}</dd>
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
  )
}
