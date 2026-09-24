import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { cardImageUrl } from './card-image'
import type { CatalogCard, CatalogSet } from './catalog-data'
import { gameColor } from './game-colors'
import { useSwipe } from './use-swipe'

// Dettaglio di una Card (docs/design.md): a tutto schermo su telefono (immagine sopra e dati
// sotto, affiancati su tablet), pannello a destra dei risultati su desktop.
// Testi ufficiali sempre come testo: React fa l'escape, niente HTML grezzo.
// Spazi che arriveranno nelle fasi successive, qui sotto le statistiche:
// Card Explanation (fase 3), prezzi (fase 5), copie possedute (fase 2).

export function CardDetail({
  card,
  sets,
  printId,
  onSelectPrinting,
  onClose,
}: {
  card: CatalogCard
  sets: readonly CatalogSet[]
  printId: string
  onSelectPrinting: (printId: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const heading = useRef<HTMLHeadingElement>(null)
  const printing = card.printings.find((p) => p.printId === printId) ?? card.printings[0]
  const setName = (code: string) => sets.find((s) => s.code === code)?.name ?? ''

  // Su telefono si passa da una Printing all'altra scorrendo l'immagine col dito.
  const index = card.printings.findIndex((p) => p.printId === printing?.printId)
  const swipe = useSwipe({
    canGo: (direction) => card.printings[index + direction] !== undefined,
    onSwipe: (direction) => {
      const next = card.printings[index + direction]
      if (next) onSelectPrinting(next.printId)
    },
  })

  // All'apertura il focus va al titolo, così tastiera e lettori di schermo partono da qui;
  // senza far scorrere i risultati accanto (su desktop il pannello è affiancato).
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [card.cardCode])

  // Con tante Printing la striscia scorre: quella scelta (anche con uno swipe) resta in vista.
  const strip = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = strip.current
    const selected = el?.querySelector<HTMLElement>('[aria-checked="true"]')
    if (!el || !selected) return
    el.scrollTo({
      left: selected.offsetLeft - (el.clientWidth - selected.offsetWidth) / 2,
      behavior: 'smooth',
    })
  }, [printing?.printId])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const stats: [string, ReactNode][] = [
    [t('detail.category'), t(`category.${card.category as 'Leader'}`)],
    ...(card.life !== null ? [[t('detail.life'), card.life] as [string, ReactNode]] : []),
    ...(card.cost !== null ? [[t('detail.cost'), card.cost] as [string, ReactNode]] : []),
    [t('detail.power'), card.power ?? '–'],
    [t('detail.counter'), card.counter === null ? '–' : `+${String(card.counter)}`],
    [t('detail.block'), card.block ?? '–'],
  ]

  return (
    <article aria-labelledby="dettaglio-titolo" className="pb-10">
      {/* Su iPhone l'app installata disegna sotto la barra di stato (black-translucent):
          la barra scende oltre notch/Dynamic Island e rientra dai bordi in orizzontale. */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/60 bg-background/90 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 backdrop-blur lg:px-6">
        <span className="truncate text-sm text-muted-foreground">
          {t('detail.printingLabel', {
            printId: printing?.printId ?? card.cardCode,
            set: printing?.setCode ?? '',
            rarity: printing?.rarity ?? '',
          })}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('detail.close')}
          className="ml-auto inline-flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:block">
        {/* Immagine e selettore delle Printing */}
        <div className="bg-muted/40 px-6 py-6">
          <div
            {...(card.printings.length > 1 ? swipe.handlers : {})}
            className={cn(
              'touch-pan-y',
              !swipe.swiping && 'transition-transform duration-200 ease-out',
            )}
            style={
              swipe.swiping ? { transform: `translateX(${String(swipe.offset)}px)` } : undefined
            }
          >
            {printing?.hasImage ? (
              <img
                src={cardImageUrl(printing.printId, 'full')}
                crossOrigin="anonymous"
                alt={card.name}
                width={600}
                height={838}
                draggable={false}
                className="mx-auto h-auto w-full max-w-[340px] rounded-2xl shadow-2xl select-none"
              />
            ) : (
              <div
                role="img"
                aria-label={t('catalog.imagePending', { name: card.name })}
                className="mx-auto flex aspect-[300/419] w-full max-w-[340px] items-center justify-center rounded-2xl bg-muted p-4 text-center text-sm text-muted-foreground"
              >
                {card.name}
              </div>
            )}
          </div>

          {card.printings.length > 1 && (
            <div
              role="radiogroup"
              aria-label={t('detail.printings')}
              ref={strip}
              className="relative mt-5 flex justify-center-safe gap-2 overflow-x-auto pb-1"
            >
              {card.printings.map((p) => (
                <button
                  key={p.printId}
                  type="button"
                  role="radio"
                  aria-checked={p.printId === printing?.printId}
                  aria-label={t('detail.printingLabel', {
                    printId: p.printId,
                    set: p.setCode,
                    rarity: p.rarity,
                  })}
                  title={p.printId}
                  onClick={() => {
                    onSelectPrinting(p.printId)
                  }}
                  className={cn(
                    'w-12 shrink-0 overflow-hidden rounded-md ring-2 transition focus-visible:ring-ring focus-visible:outline-none',
                    p.printId === printing?.printId
                      ? 'ring-foreground'
                      : 'opacity-70 ring-transparent hover:opacity-100',
                  )}
                >
                  {p.hasImage ? (
                    <img
                      src={cardImageUrl(p.printId, 'thumb')}
                      crossOrigin="anonymous"
                      alt=""
                      width={300}
                      height={419}
                      loading="lazy"
                      className="h-auto w-full"
                    />
                  ) : (
                    <span className="block aspect-[300/419] w-full bg-muted" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Dati */}
        <div className="space-y-6 px-6 pt-6">
          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {card.cardCode}
            </p>
            <h2
              id="dettaglio-titolo"
              ref={heading}
              tabIndex={-1}
              className="mt-1 text-2xl font-semibold tracking-tight focus:outline-none"
            >
              {card.name}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {card.colors.map((color) => (
                <span
                  key={color}
                  className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs"
                >
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: gameColor(color) }}
                    aria-hidden="true"
                  />
                  {t(`color.${color as 'Red'}`)}
                </span>
              ))}
              {card.attributes.map((attribute) => (
                <span key={attribute} className="rounded-full bg-muted px-2.5 py-1 text-xs">
                  {attribute}
                </span>
              ))}
              {card.types.map((type) => (
                <span
                  key={type}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {type}
                </span>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-2">
            {stats.map(([label, value]) => (
              <div key={label} className="rounded-2xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{label}</dt>
                <dd className="text-lg font-semibold tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>

          {card.keywords.length > 0 && (
            <section aria-label={t('detail.keywords')} className="flex flex-wrap gap-2">
              {card.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="rounded-full bg-foreground px-2.5 py-1 text-xs font-medium text-background"
                >
                  {keyword}
                </span>
              ))}
            </section>
          )}

          <section className="space-y-4">
            <p className="text-xs text-muted-foreground">{t('detail.officialText')}</p>
            {card.effect === null && card.trigger === null && (
              <p className="text-muted-foreground">{t('detail.noEffect')}</p>
            )}
            {card.effect !== null && (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  {t('detail.effect')}
                </h3>
                <p className="leading-relaxed whitespace-pre-line">{card.effect}</p>
              </div>
            )}
            {card.trigger !== null && (
              <div>
                <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                  {t('detail.trigger')}
                </h3>
                <p className="leading-relaxed whitespace-pre-line">{card.trigger}</p>
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">{t('detail.sets')}</h3>
            <table className="w-full text-sm">
              <thead className="sr-only">
                <tr>
                  <th>{t('detail.printColumn')}</th>
                  <th>{t('detail.setColumn')}</th>
                  <th>{t('detail.rarityColumn')}</th>
                </tr>
              </thead>
              <tbody>
                {card.printings.map((p) => (
                  <tr
                    key={p.printId}
                    className={cn(
                      'border-b last:border-0',
                      p.printId === printing?.printId && 'font-semibold',
                    )}
                  >
                    <td className="py-2 pr-3 text-xs tabular-nums">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPrinting(p.printId)
                        }}
                        className="underline-offset-2 hover:underline"
                      >
                        {p.printId}
                      </button>
                    </td>
                    <td className="py-2 pr-3">
                      <span className="text-xs text-muted-foreground">{p.setCode}</span>{' '}
                      {setName(p.setCode)}
                    </td>
                    <td className="py-2 text-right text-xs">{p.rarity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      </div>
    </article>
  )
}
