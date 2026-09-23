// PROTOTIPO RIB-8 — Variante B "Archivio": densa, a elenco, con il dettaglio affiancato (desktop) o dal basso (telefono).
import { ChevronDown, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
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
import { CardImage, ColorDots, NAV_ITEMS, ThemeButton, colorGradient } from './shared'

export const variantName = 'Archivio'

export function VariantB() {
  const sets = useLoad('sets', fetchSets)
  const [seriesId, setSeriesId] = useState(DEFAULT_SERIES_ID)
  const cards = useLoad(`set-${String(seriesId)}`, () => fetchSetCards(seriesId))
  const [query, setQuery] = useState('')
  const [setQueryText, setSetQueryText] = useState('')
  const [selected, setSelected] = useState<ProtoCard | null>(null)
  useInitialCard(cards, setSelected)

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
    <div className="proto-b flex h-svh bg-background text-foreground">
      {/* Desktop: barra laterale di navigazione */}
      <aside className="hidden w-56 shrink-0 flex-col border-r bg-muted/40 lg:flex">
        <div className="px-5 py-5 font-mono text-sm font-semibold tracking-widest uppercase">
          OP·Codex
        </div>
        <nav className="flex flex-col gap-0.5 px-2" aria-label="Sezioni">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={!item.ready}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm',
                item.ready
                  ? 'bg-background font-medium shadow-sm'
                  : 'text-muted-foreground disabled:opacity-70',
              )}
            >
              <item.icon className="size-4" />
              {item.label}
              {!item.ready && <span className="ml-auto text-[10px] uppercase">presto</span>}
            </button>
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
          Tema
          <ThemeButton />
        </div>
      </aside>

      {/* Desktop: colonna dei Set */}
      <aside className="hidden w-60 shrink-0 flex-col border-r xl:flex">
        <div className="border-b p-3">
          <input
            value={setQueryText}
            onChange={(e) => {
              setSetQueryText(e.target.value)
            }}
            placeholder="Filtra i Set"
            className="h-8 w-full rounded-md border bg-background px-2 text-sm"
          />
        </div>
        <ul className="flex-1 overflow-y-auto py-1">
          {sets.status === 'ready' &&
            sets.data
              .filter((s) =>
                `${s.code} ${s.name}`.toLowerCase().includes(setQueryText.trim().toLowerCase()),
              )
              .map((s) => (
                <li key={s.seriesId}>
                  <button
                    type="button"
                    onClick={() => {
                      setSeriesId(s.seriesId)
                      setSelected(null)
                    }}
                    className={cn(
                      'flex w-full flex-col px-3 py-1.5 text-left',
                      s.seriesId === seriesId
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted',
                    )}
                  >
                    <span className="font-mono text-xs font-semibold">{s.code}</span>
                    <span className="truncate text-xs opacity-80">{s.name}</span>
                  </button>
                </li>
              ))}
        </ul>
      </aside>

      {/* Elenco */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
          <span className="font-mono text-sm font-semibold tracking-widest uppercase lg:hidden">
            OP·Codex
          </span>
          {/* Set: menu a tendina fino a xl, poi colonna dedicata */}
          <label className="relative xl:hidden">
            <span className="sr-only">Set</span>
            <select
              value={seriesId}
              onChange={(e) => {
                setSeriesId(Number(e.target.value))
                setSelected(null)
              }}
              className="h-8 appearance-none rounded-md border bg-background pr-7 pl-2 font-mono text-xs"
            >
              {sets.status === 'ready' &&
                sets.data.map((s) => (
                  <option key={s.seriesId} value={s.seriesId}>
                    {s.code} · {s.name}
                  </option>
                ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-2 right-2 size-4" />
          </label>
          <div className="hidden xl:block">
            <div className="font-mono text-xs text-muted-foreground">{currentSet?.code}</div>
            <div className="text-sm font-semibold">{currentSet?.name}</div>
          </div>
          <label className="order-last flex h-8 w-full items-center gap-2 rounded-md border px-2 text-sm sm:order-none sm:ml-auto sm:w-64">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
              }}
              placeholder="Nome o codice"
              className="w-full bg-transparent outline-none"
            />
          </label>
          <ThemeButton className="ml-auto sm:ml-0 lg:hidden" />
        </header>

        <div className="grid grid-cols-[2.25rem_1fr_auto] items-center gap-3 border-b bg-muted/40 px-4 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid-cols-[2.25rem_6rem_1fr_6rem_4rem_4rem_5rem_4rem]">
          <span />
          <span className="hidden md:block">Codice</span>
          <span>Nome</span>
          <span className="hidden md:block">Categoria</span>
          <span className="hidden text-right md:block">Costo</span>
          <span className="hidden text-right md:block">Potenza</span>
          <span className="hidden text-right md:block">Counter</span>
          <span className="text-right">Rarità</span>
        </div>

        <ul className="flex-1 overflow-y-auto pb-20 lg:pb-0">
          {cards.status === 'loading' && (
            <li className="p-4 text-muted-foreground">Caricamento…</li>
          )}
          {visible.map((card) => (
            <li key={card.cardCode}>
              <button
                type="button"
                onClick={() => {
                  setSelected(card)
                }}
                className={cn(
                  'grid w-full grid-cols-[2.25rem_1fr_auto] items-center gap-3 border-b px-4 py-2 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none md:grid-cols-[2.25rem_6rem_1fr_6rem_4rem_4rem_5rem_4rem]',
                  selected?.cardCode === card.cardCode && 'bg-muted',
                )}
              >
                <span className="relative overflow-hidden rounded-sm">
                  <CardImage printId={card.printId} name={card.name} hasImage={card.hasImage} />
                  <span
                    className="absolute inset-x-0 bottom-0 h-1"
                    style={{ background: colorGradient(card.colors) }}
                  />
                </span>
                <span className="hidden font-mono text-xs md:block">{card.cardCode}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium">{card.name}</span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground md:hidden">
                    <span className="font-mono">{card.cardCode}</span>
                    <ColorDots colors={card.colors} />
                    {card.cost !== null && <span>C{card.cost}</span>}
                    {card.power !== null && <span>{card.power}</span>}
                  </span>
                </span>
                <span className="hidden items-center gap-2 text-xs md:flex">
                  <ColorDots colors={card.colors} /> {card.category}
                </span>
                <span className="hidden text-right font-mono tabular-nums md:block">
                  {card.cost ?? card.life ?? '–'}
                </span>
                <span className="hidden text-right font-mono tabular-nums md:block">
                  {card.power ?? '–'}
                </span>
                <span className="hidden text-right font-mono tabular-nums md:block">
                  {card.counter ?? '–'}
                </span>
                <span className="text-right font-mono text-xs">{card.rarity}</span>
              </button>
            </li>
          ))}
        </ul>
      </main>

      {/* Dettaglio: pannello a destra (desktop) o dal basso (telefono) */}
      {selected && (
        <>
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => {
              setSelected(null)
            }}
          />
          <aside
            aria-label={selected.name}
            className="fixed inset-x-0 bottom-0 z-40 max-h-[88svh] overflow-y-auto rounded-t-2xl border-t bg-background shadow-2xl lg:static lg:max-h-none lg:w-[420px] lg:shrink-0 lg:rounded-none lg:border-t-0 lg:border-l lg:shadow-none"
          >
            <DetailPanel
              card={selected}
              onClose={() => {
                setSelected(null)
              }}
            />
          </aside>
        </>
      )}

      {/* Telefono: barra in basso */}
      <nav
        aria-label="Sezioni"
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t bg-background pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {NAV_ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            disabled={!item.ready}
            className={cn(
              'flex flex-col items-center gap-0.5 py-2 text-[10px] tracking-wide uppercase',
              item.ready ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            <item.icon className="size-5" />
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  )
}

function DetailPanel({ card, onClose }: { card: ProtoCard; onClose: () => void }) {
  const printings = useLoad(`p-${card.cardCode}`, () => fetchCardPrintings(card.cardCode))
  const [selected, setSelected] = useState(card.printId)
  const current =
    printings.status === 'ready' ? printings.data.find((p) => p.printId === selected) : undefined

  const rows: [string, string][] = [
    ['Codice', card.cardCode],
    ['Categoria', card.category],
    ['Colore', card.colors.join(' / ')],
    ...(card.life !== null ? [['Vita', String(card.life)] as [string, string]] : []),
    ...(card.cost !== null ? [['Costo', String(card.cost)] as [string, string]] : []),
    ['Potenza', card.power !== null ? String(card.power) : '–'],
    ['Counter', card.counter !== null ? `+${String(card.counter)}` : '–'],
    ['Attributo', card.attributes.join(' / ') || '–'],
    ['Tipo', card.types.join(' / ')],
    ['Block', card.block ?? '–'],
  ]

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto h-1 w-10 rounded-full bg-muted-foreground/30 lg:hidden" />
        <h2 className="absolute left-4 max-w-[70%] truncate text-sm font-semibold lg:static lg:max-w-none">
          {card.name}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi"
          className="ml-auto inline-flex size-8 items-center justify-center rounded-md hover:bg-muted"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-[8rem_1fr] gap-4 p-4 lg:grid-cols-1">
        <CardImage
          printId={selected}
          name={card.name}
          hasImage={current?.hasImage ?? card.hasImage}
          variant="full"
          className="rounded-lg lg:mx-auto lg:max-w-[260px]"
        />
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 self-start text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-mono text-xs leading-5">{v}</dd>
            </div>
          ))}
        </dl>
      </div>

      {card.effect && (
        <section className="border-t px-4 py-3">
          <h3 className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Effetto
          </h3>
          <p className="text-sm leading-relaxed whitespace-pre-line">{card.effect}</p>
        </section>
      )}
      {card.trigger && (
        <section className="border-t px-4 py-3">
          <h3 className="mb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
            Trigger
          </h3>
          <p className="text-sm leading-relaxed">{card.trigger}</p>
        </section>
      )}

      <section className="border-t px-4 py-3 pb-8">
        <h3 className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          Printing
        </h3>
        <table className="w-full text-xs">
          <tbody>
            {printings.status === 'ready' &&
              printings.data.map((p) => (
                <tr
                  key={p.printId}
                  onClick={() => {
                    setSelected(p.printId)
                  }}
                  className={cn(
                    'cursor-pointer border-b last:border-0',
                    p.printId === selected ? 'bg-muted font-semibold' : 'hover:bg-muted/50',
                  )}
                >
                  <td className="py-1.5 font-mono">{p.printId}</td>
                  <td className="font-mono">{p.setCode}</td>
                  <td className="text-right font-mono">{p.rarity}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
