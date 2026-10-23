import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useTilt } from '@/lib/use-tilt'
import { cn } from '@/lib/utils'
import { CardFlags } from './CardFlags'
import { useCardFlags } from './card-flags'
import { cardImageUrl } from './card-image'
import { cardPath } from './card-links'
import type { CardLinkState } from './CardDetailRoute'
import type { CatalogEntry } from './filters'
import { colorBar } from './game-colors'
import { gridColumns, type GridSize } from './grid-size'

// Proporzioni della miniatura (300×419): riservano lo spazio prima del caricamento.
const THUMB_WIDTH = 300
const THUMB_HEIGHT = 419
/** Voci mostrate per blocco: le successive arrivano scorrendo, così la pagina resta fluida. */
const PAGE = 60

const LINK_STATE: CardLinkState = { fromCatalog: true }

export type CatalogView = 'grid' | 'list'

function Thumbnail({ entry, className }: { entry: CatalogEntry; className?: string }) {
  const { t } = useTranslation()
  const { card, printing } = entry
  if (!printing.hasImage) {
    return (
      <div
        role="img"
        aria-label={t('catalog.imagePending', { name: card.name })}
        className={cn(
          'flex aspect-[300/419] w-full items-center justify-center bg-muted p-2 text-center text-[10px] text-muted-foreground',
          className,
        )}
      >
        {card.name}
      </div>
    )
  }
  return (
    <img
      src={cardImageUrl(printing, 'thumb')}
      // Richiesta CORS: così il service worker può salvarla per l'offline (RIB-16).
      crossOrigin="anonymous"
      alt={card.name}
      width={THUMB_WIDTH}
      height={THUMB_HEIGHT}
      loading="lazy"
      decoding="async"
      className={cn('h-auto w-full bg-muted', className)}
    />
  )
}

export function CatalogResults({
  entries,
  view,
  gridSize = 'large',
  openCode,
}: {
  entries: readonly CatalogEntry[]
  view: CatalogView
  /** Carte grandi, medie o piccole nella griglia (RIB-79). */
  gridSize?: GridSize
  /** Card aperta nel dettaglio, evidenziata nei risultati. */
  openCode: string | null
}) {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const [limit, setLimit] = useState(PAGE)
  const tilt = useTilt()
  const sentinel = useRef<HTMLDivElement>(null)

  // Nuova ricerca: si riparte dal primo blocco.
  const [previous, setPrevious] = useState(entries)
  if (previous !== entries) {
    setPrevious(entries)
    setLimit(PAGE)
  }

  useEffect(() => {
    const target = sentinel.current
    if (!target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (items) => {
        if (items.some((i) => i.isIntersecting)) setLimit((l) => l + PAGE)
      },
      { rootMargin: '800px' },
    )
    observer.observe(target)
    return () => {
      observer.disconnect()
    }
  }, [limit, entries])

  const visible = entries.slice(0, limit)
  const key = (e: CatalogEntry) => e.printing.printId
  const to = (e: CatalogEntry) => cardPath(e.card.cardCode, params, e.printing.printId)
  const isOpen = (e: CatalogEntry) => e.card.cardCode === openCode
  // Con un dettaglio già aperto (pannello affiancato su desktop e tablet) la nuova carta prende
  // il posto della precedente nella cronologia, conservandone lo stato: così "chiudi" torna
  // sempre ai risultati invece di ripercorrere a ritroso le carte aperte una dopo l'altra.
  const location = useLocation()
  // RIB-97: nel catalogo anche le carte fuori Standard, il formato più giocato.
  const flagsOf = useCardFlags({ standard: true })
  const linkProps = openCode
    ? { replace: true, state: location.state as unknown }
    : { state: LINK_STATE }

  return (
    <>
      {view === 'grid' ? (
        <ul className={gridColumns(gridSize, openCode !== null)} {...tilt}>
          {visible.map((entry, index) => (
            <li
              key={key(entry)}
              // Entrata a cascata, blocco per blocco (index.css, .rise-in).
              className="rise-in [content-visibility:auto]"
              style={{ '--i': index % PAGE } as CSSProperties}
            >
              <Link
                to={to(entry)}
                {...linkProps}
                aria-current={isOpen(entry) ? 'true' : undefined}
                className="group block rounded-xl focus-visible:outline-none"
              >
                <div
                  className={cn(
                    'holo shadow-sm group-focus-visible:ring-2 group-focus-visible:ring-gold',
                    gridSize === 'large' ? 'rounded-xl' : 'rounded-md',
                    isOpen(entry) && 'ring-2 ring-gold',
                  )}
                >
                  <Thumbnail
                    entry={entry}
                    className={gridSize === 'large' ? 'rounded-xl' : 'rounded-md'}
                  />
                  {/* RIB-29, ADR-0016, RIB-97: Ban List, anteprima, fuori Standard. */}
                  <CardFlags
                    flags={flagsOf(entry.card, entry.printing)}
                    compact={gridSize !== 'large'}
                    className={cn(
                      'absolute',
                      gridSize === 'small' ? 'top-0.5 left-0.5' : 'top-2 right-2 left-2',
                    )}
                  />
                </div>
                {/* Con le carte piccole i testi non ci stanno: il nome resta nell'alt. */}
                {gridSize === 'large' && (
                  <>
                    <span className="mt-2 block truncate text-sm font-medium">
                      {entry.card.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {entry.printing.printId}
                    </span>
                  </>
                )}
                {gridSize === 'medium' && (
                  <span className="mt-1 block truncate text-[11px] text-muted-foreground">
                    {entry.printing.printId}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-2xl border">
          <div
            className={cn(
              'hidden gap-3 border-b bg-muted/50 px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid',
              openCode
                ? 'grid-cols-[2.5rem_1fr_3.5rem_4.5rem_4.5rem_3.5rem] [&>.col-extra]:hidden'
                : 'grid-cols-[2.5rem_6.5rem_1fr_7rem_3.5rem_4.5rem_4.5rem_3.5rem]',
            )}
          >
            <span />
            <span className="col-extra">{t('catalog.columns.code')}</span>
            <span>{t('catalog.columns.name')}</span>
            <span className="col-extra">{t('catalog.columns.category')}</span>
            <span className="text-right">{t('catalog.columns.cost')}</span>
            <span className="text-right">{t('catalog.columns.power')}</span>
            <span className="text-right">{t('catalog.columns.counter')}</span>
            <span className="text-right">{t('catalog.columns.rarity')}</span>
          </div>
          <ul>
            {visible.map((entry) => {
              const { card, printing } = entry
              const cost = card.cost ?? card.life
              const category = t(`category.${card.category as 'Leader'}`)
              return (
                <li key={key(entry)} className="border-b last:border-0">
                  <Link
                    to={to(entry)}
                    {...linkProps}
                    aria-current={isOpen(entry) ? 'true' : undefined}
                    className={cn(
                      'grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-3 py-2 text-sm hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none',
                      openCode
                        ? 'md:grid-cols-[2.5rem_1fr_3.5rem_4.5rem_4.5rem_3.5rem] md:[&>.col-extra]:hidden'
                        : 'md:grid-cols-[2.5rem_6.5rem_1fr_7rem_3.5rem_4.5rem_4.5rem_3.5rem]',
                      isOpen(entry) && 'bg-muted',
                    )}
                  >
                    <span className="relative overflow-hidden rounded-md">
                      <Thumbnail entry={entry} />
                      <span
                        className="absolute inset-x-0 bottom-0 h-1"
                        style={{ background: colorBar(card.colors) }}
                      />
                    </span>
                    <span className="col-extra hidden text-xs text-muted-foreground tabular-nums md:block">
                      {printing.printId}
                    </span>
                    <span className="min-w-0">
                      <CardFlags flags={flagsOf(card, printing)} className="mb-0.5" />
                      <span className="block truncate font-medium">{card.name}</span>
                      <span className="block truncate text-xs text-muted-foreground md:hidden">
                        {t('catalog.cardLabel', { code: printing.printId, name: category })}
                      </span>
                    </span>
                    <span className="col-extra hidden text-xs text-muted-foreground md:block">
                      {category}
                    </span>
                    <span className="hidden text-right tabular-nums md:block">{cost ?? '–'}</span>
                    <span className="hidden text-right tabular-nums md:block">
                      {card.power ?? '–'}
                    </span>
                    <span className="hidden text-right tabular-nums md:block">
                      {card.counter === null ? '–' : `+${String(card.counter)}`}
                    </span>
                    <span className="text-right text-xs text-muted-foreground">
                      {printing.rarity}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {limit < entries.length && (
        <div ref={sentinel} className="flex justify-center py-6">
          <button
            type="button"
            onClick={() => {
              setLimit((l) => l + PAGE)
            }}
            className="rounded-full border px-4 py-2 text-sm hover:bg-muted"
          >
            {t('catalog.loadMore')}
          </button>
        </div>
      )}
    </>
  )
}
