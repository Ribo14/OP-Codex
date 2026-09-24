import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useLocation,
  useNavigate,
  useOutletContext,
  useParams,
  useSearchParams,
} from 'react-router'
import { catalogPath, PRINTING_PARAM } from './card-links'
import type { Catalog } from './catalog-data'
import { CardDetail } from './CardDetail'

export interface CatalogOutletContext {
  catalog: Catalog
}

/** Stato del link che apre il dettaglio dal catalogo: chiudere torna indietro nella cronologia. */
export interface CardLinkState {
  fromCatalog: true
}

// /carta/:cardCode?stampa=<Print ID> — dentro la pagina del catalogo (vedi routes.tsx).
export function CardDetailRoute() {
  const { t } = useTranslation()
  const { catalog } = useOutletContext<CatalogOutletContext>()
  const { cardCode = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()

  const code = cardCode.toUpperCase()
  const card = catalog.cards.find((c) => c.cardCode === code)
  const requested = params.get(PRINTING_PARAM)
  const printId =
    card?.printings.find((p) => p.printId === requested)?.printId ??
    card?.printings[0]?.printId ??
    code

  const fromCatalog = (location.state as CardLinkState | null)?.fromCatalog === true
  const close = useCallback(() => {
    if (fromCatalog) void navigate(-1)
    else void navigate(catalogPath(params))
  }, [fromCatalog, navigate, params])

  const selectPrinting = useCallback(
    (next: string) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          if (next === code) updated.delete(PRINTING_PARAM)
          else updated.set(PRINTING_PARAM, next)
          return updated
        },
        // Cambiare Printing non riempie la cronologia; si mantiene lo stato di apertura.
        { replace: true, state: location.state as unknown },
      )
    },
    [code, location.state, setParams],
  )

  return (
    <aside
      aria-label={card?.name ?? t('detail.notFound')}
      className="fixed inset-0 z-40 overflow-y-auto bg-background safe-x lg:sticky lg:top-0 lg:z-auto lg:max-h-[calc(100svh-4rem)] lg:w-[440px] lg:shrink-0 lg:rounded-2xl lg:border"
    >
      {card ? (
        <CardDetail
          card={card}
          sets={catalog.sets}
          printId={printId}
          onSelectPrinting={selectPrinting}
          onClose={close}
        />
      ) : (
        <div className="space-y-4 p-6 pt-[calc(env(safe-area-inset-top)+1.5rem)]">
          <h2 className="text-xl font-semibold">{t('detail.notFound')}</h2>
          <p className="text-muted-foreground">{t('detail.notFoundBody', { code })}</p>
          <button
            type="button"
            onClick={close}
            className="rounded-full bg-foreground px-4 py-2 text-sm text-background"
          >
            {t('detail.close')}
          </button>
        </div>
      )}
    </aside>
  )
}
