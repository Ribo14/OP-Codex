import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useAsync } from '@/lib/use-async'
import { CardGrid } from './CardGrid'
import { fetchSetPrintings, fetchSets } from './catalog-api'
import { pickDisplayPrintings } from './display-printings'

const loadSets = () => fetchSets()
const loadDisplayPrintings = async (seriesId: string) =>
  pickDisplayPrintings(await fetchSetPrintings(Number(seriesId)))

// Catalogo minimo (un Set alla volta). Ricerca e filtri su tutto il catalogo arrivano con RIB-15.
export function CatalogPage() {
  const { t } = useTranslation()
  const sets = useAsync('sets', loadSets)
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null)

  const seriesId =
    selectedSeriesId ?? (sets.status === 'ready' ? (sets.data[0]?.seriesId ?? null) : null)
  const printings = useAsync(seriesId === null ? null : String(seriesId), loadDisplayPrintings)
  const currentSet =
    sets.status === 'ready' ? sets.data.find((s) => s.seriesId === seriesId) : undefined

  return (
    <section className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{t('catalog.title')}</h1>

      {(sets.status === 'loading' || sets.status === 'idle') && (
        <p className="text-muted-foreground">{t('catalog.loading')}</p>
      )}
      {sets.status === 'error' && (
        <p role="alert">{t('catalog.error', { message: sets.message })}</p>
      )}
      {sets.status === 'ready' && sets.data.length === 0 && (
        <p className="text-muted-foreground">{t('catalog.empty')}</p>
      )}

      {sets.status === 'ready' && sets.data.length > 0 && (
        <>
          <div
            role="group"
            aria-label={t('catalog.set')}
            className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-wrap lg:px-0 [&::-webkit-scrollbar]:hidden"
          >
            {sets.data.map((set) => (
              <button
                key={set.seriesId}
                type="button"
                aria-pressed={set.seriesId === seriesId}
                onClick={() => {
                  setSelectedSeriesId(set.seriesId)
                }}
                title={set.name}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                  set.seriesId === seriesId
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground',
                )}
              >
                {set.code}
              </button>
            ))}
          </div>

          {currentSet && <h2 className="text-lg font-medium">{currentSet.name}</h2>}
          {printings.status === 'error' && (
            <p role="alert">{t('catalog.error', { message: printings.message })}</p>
          )}
          {(printings.status === 'loading' || printings.status === 'idle') && (
            <p className="text-muted-foreground">{t('catalog.loadingCards')}</p>
          )}
          {printings.status === 'ready' && <CardGrid printings={printings.data} />}
        </>
      )}
    </section>
  )
}
