import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { cardImageUrl } from './card-image'
import type { CatalogEntry } from './filters'

// Proporzioni della miniatura (300×419): riservano lo spazio prima del caricamento.
const THUMB_WIDTH = 300
const THUMB_HEIGHT = 419
/** Voci mostrate per blocco: le successive arrivano scorrendo, così la pagina resta fluida. */
const PAGE = 60

export type CatalogView = 'grid' | 'list'

const GAME_COLOR: Record<string, string> = {
  Red: 'var(--color-game-red)',
  Green: 'var(--color-game-green)',
  Blue: 'var(--color-game-blue)',
  Purple: 'var(--color-game-purple)',
  Black: 'var(--color-game-black)',
  Yellow: 'var(--color-game-yellow)',
}

function colorBar(colors: readonly string[]): string {
  const values = colors.map((c) => GAME_COLOR[c] ?? 'var(--muted-foreground)')
  return values.length > 1 ? `linear-gradient(90deg, ${values.join(', ')})` : (values[0] ?? '')
}

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
      src={cardImageUrl(printing.printId, 'thumb')}
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
}: {
  entries: readonly CatalogEntry[]
  view: CatalogView
}) {
  const { t } = useTranslation()
  const [limit, setLimit] = useState(PAGE)
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

  return (
    <>
      {view === 'grid' ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:gap-6 xl:grid-cols-5 2xl:grid-cols-6">
          {visible.map((entry) => (
            <li key={key(entry)} className="[content-visibility:auto]">
              <Thumbnail entry={entry} className="rounded-xl shadow-sm" />
              <span className="mt-2 block truncate text-sm font-medium">{entry.card.name}</span>
              <span className="block text-xs text-muted-foreground">{entry.printing.printId}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="overflow-hidden rounded-2xl border">
          <div className="hidden grid-cols-[2.5rem_6.5rem_1fr_7rem_3.5rem_4.5rem_4.5rem_3.5rem] gap-3 border-b bg-muted/50 px-3 py-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase md:grid">
            <span />
            <span>{t('catalog.columns.code')}</span>
            <span>{t('catalog.columns.name')}</span>
            <span>{t('catalog.columns.category')}</span>
            <span className="text-right">{t('catalog.columns.cost')}</span>
            <span className="text-right">{t('catalog.columns.power')}</span>
            <span className="text-right">{t('catalog.columns.counter')}</span>
            <span className="text-right">{t('catalog.columns.rarity')}</span>
          </div>
          <ul>
            {visible.map((entry) => {
              const { card, printing } = entry
              const cost = card.cost ?? card.life
              return (
                <li
                  key={key(entry)}
                  className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 border-b px-3 py-2 text-sm last:border-0 md:grid-cols-[2.5rem_6.5rem_1fr_7rem_3.5rem_4.5rem_4.5rem_3.5rem]"
                >
                  <span className="relative overflow-hidden rounded-md">
                    <Thumbnail entry={entry} />
                    <span
                      className="absolute inset-x-0 bottom-0 h-1"
                      style={{ background: colorBar(card.colors) }}
                    />
                  </span>
                  <span className="hidden text-xs text-muted-foreground tabular-nums md:block">
                    {printing.printId}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{card.name}</span>
                    <span className="block truncate text-xs text-muted-foreground md:hidden">
                      {t('catalog.cardLabel', {
                        code: printing.printId,
                        name: t(`category.${card.category as 'Leader'}`),
                      })}
                    </span>
                  </span>
                  <span className="hidden text-xs text-muted-foreground md:block">
                    {t(`category.${card.category as 'Leader'}`)}
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
