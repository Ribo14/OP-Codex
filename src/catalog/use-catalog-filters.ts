import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import {
  EMPTY_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
  type CatalogFilters,
} from './filters'

/**
 * I filtri vivono nell'URL: una ricerca si condivide copiando il link e il tasto
 * indietro funziona. La digitazione nel campo di ricerca non riempie la cronologia.
 */
export function useCatalogFilters() {
  const [params, setParams] = useSearchParams()
  const filters = useMemo(() => filtersFromSearchParams(params), [params])

  const update = useCallback(
    (patch: Partial<CatalogFilters>, options: { typing?: boolean } = {}) => {
      setParams(
        (current) => filtersToSearchParams({ ...filtersFromSearchParams(current), ...patch }),
        { replace: options.typing === true },
      )
    },
    [setParams],
  )

  const reset = useCallback(() => {
    setParams(filtersToSearchParams(EMPTY_FILTERS))
  }, [setParams])

  return { filters, update, reset }
}

/** Aggiunge o toglie un valore da un filtro a scelta multipla. */
export function toggle(list: readonly string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}
