import { SlidersHorizontal, X } from 'lucide-react'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useMatch } from 'react-router'
import { useSession } from '@/account/session'
import { LogoLoader } from '@/app/LogoLoader'
import { useOwnership } from '@/collection/collection-store'
import { SearchField } from '@/components/SearchField'
import { cn } from '@/lib/utils'
import { useBanList } from './ban-list'
import type { CatalogOutletContext } from './CardDetailRoute'
import { CatalogResults, type CatalogView } from './CatalogResults'
import { catalogFacets, countActiveFilters, filterCatalog } from './filters'
import { FiltersPanel } from './FiltersPanel'
import { useGridSize } from './grid-size'
import { OFFLINE, useCatalog } from './local-catalog'
import { SetImagesDownload } from './SetImagesDownload'
import { ViewMenu } from './ViewMenu'
import { useCatalogFilters } from './use-catalog-filters'

const VIEW_KEY = 'op-codex-catalog-view'

function readView(): CatalogView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export function CatalogPage() {
  const { t } = useTranslation()
  const { catalog, checkedAt, syncing, error, retry } = useCatalog()
  const { filters, update, reset } = useCatalogFilters()
  const deferredFilters = useDeferredValue(filters)
  const [view, setViewState] = useState<CatalogView>(readView)
  const [gridSize, setGridSize] = useGridSize()
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

  const facets = useMemo(() => (catalog ? catalogFacets(catalog.cards) : null), [catalog])
  // Filtro "possedute" (RIB-22): solo con l'accesso e la Collection caricata.
  const ownership = useOwnership()
  const signedIn = useSession().status === 'signedIn'
  // Filtro Ban List (RIB-50): la lista in vigore oggi, anche offline.
  const banList = useBanList()
  const entries = useMemo(
    () => (catalog ? filterCatalog(catalog.cards, deferredFilters, ownership, banList) : []),
    [catalog, deferredFilters, ownership, banList],
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

  if (!catalog) {
    // Primo avvio: il catalogo non è ancora sul dispositivo.
    if (!error) return <LogoLoader label={t('catalog.loading')} />
    return (
      <div role="alert" className="flex flex-col items-start gap-3">
        <p>{t('offline.firstLoadError')}</p>
        {error !== OFFLINE && (
          <p className="text-sm text-muted-foreground">{t('catalog.error', { message: error })}</p>
        )}
        <button
          type="button"
          disabled={syncing}
          onClick={() => {
            void retry()
          }}
          className="h-10 rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
        >
          {t('offline.retry')}
        </button>
      </div>
    )
  }
  if (catalog.cards.length === 0 || !facets) {
    return <p className="text-muted-foreground">{t('catalog.empty')}</p>
  }

  const panel = (
    <FiltersPanel
      filters={filters}
      update={update}
      facets={facets}
      sets={catalog.sets}
      showOwned={signedIn}
    />
  )

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{t('catalog.title')}</h1>

      {/* RIB-88: una riga sola. Lo Scanner sta nella navigazione; i filtri qui solo dove non c'è
          il pannello laterale. Il pulsante dei filtri mostra quanti sono attivi. */}
      <div className="flex items-center gap-2">
        <SearchField
          value={filters.q}
          label={t('catalog.search')}
          onChange={(q) => {
            update({ q }, { typing: true })
          }}
          className="min-w-0 flex-1"
        />

        <button
          type="button"
          aria-label={
            active > 0 ? t('catalog.filtersCount', { count: active }) : t('catalog.filters')
          }
          onClick={() => {
            setPanelOpen(true)
          }}
          className={cn(
            'relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border hover:bg-muted sm:w-auto sm:gap-2 sm:px-4 sm:text-sm sm:font-medium',
            openCode ? '2xl:hidden' : 'lg:hidden',
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">{t('catalog.filters')}</span>
          {active > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex min-w-5 items-center justify-center rounded-full bg-foreground px-1 text-[11px] font-semibold text-background tabular-nums sm:static sm:bg-transparent sm:px-0 sm:text-foreground">
              {active}
            </span>
          )}
        </button>

        <ViewMenu
          value={view === 'list' ? 'list' : gridSize}
          onChange={(choice) => {
            if (choice === 'list') setView('list')
            else {
              setView('grid')
              setGridSize(choice)
            }
          }}
        />
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
        <DataStatus
          checkedAt={checkedAt}
          syncing={syncing}
          failed={error !== null && error !== OFFLINE}
        />
      </div>

      {filters.sets.length === 1 && filters.sets[0] && (
        <SetImagesDownload key={filters.sets[0]} cards={catalog.cards} setCode={filters.sets[0]} />
      )}

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
            <CatalogResults entries={entries} view={view} gridSize={gridSize} openCode={openCode} />
          )}
        </div>

        {/* Dettaglio della Card (/carta/:cardCode) */}
        <Outlet context={{ catalog } satisfies CatalogOutletContext} />
      </div>

      {/* Telefono: filtri in un pannello a tutto schermo */}
      {panelOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('catalog.filters')}
          className="fixed inset-0 z-50 flex flex-col bg-background safe-x lg:hidden"
        >
          {/* box-content: l'altezza di 3.5rem resta tutta sotto la barra di stato di iPhone */}
          <div className="box-content flex h-14 shrink-0 items-center gap-3 border-b px-4 safe-top">
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

/** Quanto sono recenti i dati sul dispositivo. */
function DataStatus({
  checkedAt,
  syncing,
  failed,
}: {
  checkedAt: number | null
  syncing: boolean
  failed: boolean
}) {
  const { t, i18n } = useTranslation()
  if (syncing) {
    return <span className="ml-auto text-xs text-muted-foreground">{t('offline.syncing')}</span>
  }
  if (checkedAt === null) return null
  const date = new Intl.DateTimeFormat(i18n.language, {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(checkedAt)
  return (
    <span className="ml-auto text-xs text-muted-foreground">
      {t(failed ? 'offline.dataFromFailed' : 'offline.dataFrom', { date })}
    </span>
  )
}
