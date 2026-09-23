import { useState } from 'react'
import { useAsync } from '@/lib/use-async'
import { CardGrid } from './CardGrid'
import { fetchSetPrintings, fetchSets } from './catalog-api'
import { pickDisplayPrintings } from './display-printings'

const loadSets = () => fetchSets()
const loadDisplayPrintings = async (seriesId: string) =>
  pickDisplayPrintings(await fetchSetPrintings(Number(seriesId)))

export function CatalogPage() {
  const sets = useAsync('sets', loadSets)
  const [selectedSeriesId, setSelectedSeriesId] = useState<number | null>(null)

  const seriesId =
    selectedSeriesId ?? (sets.status === 'ready' ? (sets.data[0]?.seriesId ?? null) : null)
  const printings = useAsync(seriesId === null ? null : String(seriesId), loadDisplayPrintings)

  if (sets.status === 'loading' || sets.status === 'idle') return <p>Caricamento del catalogo…</p>
  if (sets.status === 'error') return <p role="alert">Errore: {sets.message}</p>
  if (sets.data.length === 0) {
    return <p>Il catalogo è vuoto: sincronizza un Set con npm run sync:set.</p>
  }

  return (
    <section className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-sm">
        Set
        <select
          className="rounded-md border border-input bg-background px-2 py-1"
          value={seriesId ?? ''}
          onChange={(event) => {
            setSelectedSeriesId(Number(event.target.value))
          }}
        >
          {sets.data.map((set) => (
            <option key={set.seriesId} value={set.seriesId}>
              {set.code} · {set.name}
            </option>
          ))}
        </select>
      </label>

      {printings.status === 'error' && <p role="alert">Errore: {printings.message}</p>}
      {(printings.status === 'loading' || printings.status === 'idle') && (
        <p>Caricamento delle carte…</p>
      )}
      {printings.status === 'ready' && <CardGrid printings={printings.data} />}
    </section>
  )
}
