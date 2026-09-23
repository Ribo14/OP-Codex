import { LayoutGrid, List, Search, SlidersHorizontal, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useMatch } from 'react-router'
import { cn } from '@/lib/utils'
import { useAsync } from '@/lib/use-async'
import type { CatalogOutletContext } from './CardDetailRoute'
import { loadCatalog } from './catalog-data'
import { CatalogResults, type CatalogView } from './CatalogResults'
import { catalogFacets, countActiveFilters, filterCatalog } from './filters'
import { FiltersPanel } from './FiltersPanel'
import { useCatalogFilters } from './use-catalog-filters'

const VIEW_KEY = 'op-codex-catalog-view'

const VIEWS = [
  { key: 'grid', Icon: LayoutGrid },
  { key: 'list', Icon: List },
] as const

function readView(): CatalogView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

const load = () => loadCatalog()

export function CatalogPage() {
  const { t } = useTranslation()
  const catalog = useAsync('catalog', load)
  const { filters, update, reset } = useCatalogFilters()
  const deferredFilters = useDeferredValue(filters)
  const [view, setViewState] = useState<CatalogView>(readView)
  const [panelOpen, setPanelOpen] = useState(false)
  const detail = useMatch('/carta/:cardCode')
  const openCode = detail?.params.cardCode?.toUpperCase() ?? null

  const setView = (next: CatalogView) => {
    setViewState(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      /* la scelta vale solo per questa sessione */
    }
  }

  const facets = useMemo(
    () => (catalog.status === 'ready' ? catalogFacets(catalog.data.cards) : null),
    [catalog],
  )
  const entries = useMemo(
    () => (catalog.status === 'ready' ? filterCatalog(catalog.data.cards, deferredFilters) : []),
    [catalog, deferredFilters],
  )
  const active = countActiveFilters(filters)

  // Esc chiude il pannello dei filtri sul telefono.
  useEffect(() => {
    if (!panelOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPanelOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
    }
  }, [panelOpen])

  if (catalog.status === 'loading' || catalog.status === 'idle') {
    return <p className="text-muted-foreground">{t('catalog.loading')}</p>
  }
  if (catalog.status === 'error') {
    return <p role="alert">{t('catalog.error', { message: catalog.message })}</p>
  }
  if (catalog.data.cards.length === 0 || !facets) {
    return <p className="text-muted-foreground">{t('catalog.empty')}</p>
  }

  const panel = (
    <FiltersPanel filters={filters} update={update} facets={facets} sets={catalog.data.sets} />
  )

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{t('catalog.title')}</h1>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex h-10 min-w-0 flex-1 basis-64 items-center gap-2 rounded-full bg-muted px-4 text-sm">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{t('catalog.search')}</span>
          <input
            type="search"
            value={filters.q}
            placeholder={t('catalog.search')}
            onChange={(e) => {
              update({ q: e.target.value }, { typing: true })
            }}
            className="w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </label>

        <button
          type="button"
          onClick={() => {
            setPanelOpen(true)
          }}
          className="inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium lg:hidden"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          {active > 0 ? t('catalog.filtersCount', { count: active }) : t('catalog.filters')}
        </button>

        <div role="group" aria-label={t('catalog.view')} className="flex rounded-full bg-muted p-1">
          {VIEWS.map(({ key, Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              aria-label={t(`catalog.${key}`)}
              title={t(`catalog.${key}`)}
              onClick={() => {
                setView(key)
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                view === key ? 'bg-background shadow-sm' : 'text-muted-foreground',
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">{t(`catalog.${key}`)}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-muted-foreground" aria-live="polite">
          {t('catalog.results', { count: entries.length })}
        </span>
        {(active > 0 || filters.q) && (
          <button
            type="button"
            onClick={reset}
            className="text-sm font-medium underline underline-offset-2 hover:text-muted-foreground"
          >
            {t('catalog.reset')}
          </button>
        )}
      </div>

      <div className="flex items-start gap-6">
        {/* Desktop: filtri a sinistra dei risultati; col dettaglio aperto solo sugli schermi molto larghi */}
        <aside
          aria-label={t('catalog.filters')}
          className={cn(
            'sticky top-0 hidden max-h-[calc(100svh-4rem)] w-72 shrink-0 overflow-y-auto pr-2 pb-8',
            openCode ? '2xl:block' : 'lg:block',
          )}
        >
          {panel}
        </aside>

        <div className="min-w-0 flex-1">
          {entries.length === 0 ? (
            <p className="py-10 text-center text-muted-foreground">{t('catalog.noResults')}</p>
          ) : (
            <CatalogResults entries={entries} view={view} openCode={openCode} />
          )}
        </div>

        {/* Dettaglio della Card (/carta/:cardCode) */}
        <Outlet context={{ catalog: catalog.data } satisfies CatalogOutletContext} />
      </div>

      {/* Telefono: filtri in un pannello a tutto schermo */}
      {panelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('catalog.filters')}
          className="fixed inset-0 z-50 flex flex-col bg-background lg:hidden"
        >
          <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
            <span className="font-semibold">{t('catalog.filters')}</span>
            {active > 0 && (
              <button
                type="button"
                onClick={reset}
                className="text-sm text-muted-foreground underline underline-offset-2"
              >
                {t('catalog.reset')}
              </button>
            )}
            <button
              type="button"
              aria-label={t('catalog.close')}
              onClick={() => {
                setPanelOpen(false)
              }}
              className="ml-auto inline-flex size-10 items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-5">{panel}</div>
          <div className="shrink-0 border-t p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <button
              type="button"
              onClick={() => {
                setPanelOpen(false)
              }}
              className="h-12 w-full rounded-full bg-foreground text-sm font-medium text-background"
            >
              {t('catalog.showResults', { count: entries.length })}
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
