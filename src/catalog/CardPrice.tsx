import { ExternalLink } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CatalogPrinting } from './catalog-data'
import { cardmarketUrl, useEuro } from './price-format'

// Prezzo Cardmarket della Printing mostrata (RIB-32): tendenza e minimo in euro, giorno del
// listino e link al Marketplace. Arriva con il catalogo, quindi si vede anche offline.

export function CardPrice({
  cardCode,
  printing,
}: {
  cardCode: string
  printing: CatalogPrinting | undefined
}) {
  const { t, i18n } = useTranslation()
  const euro = useEuro()
  const price = printing?.price ?? null
  const date = price?.date
    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'short' }).format(
        new Date(`${price.date}T12:00:00`),
      )
    : null

  return (
    <section aria-labelledby="prezzo-titolo" className="space-y-2">
      <div className="flex items-baseline gap-3">
        <h3 id="prezzo-titolo" className="text-sm font-medium text-muted-foreground">
          {t('detail.price.title')}
        </h3>
        <a
          href={cardmarketUrl(cardCode)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
        >
          {t('detail.price.link')}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </div>
      {price ? (
        <>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">{t('detail.price.trend')}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {price.trend === null ? '–' : euro(price.trend)}
              </dd>
            </div>
            <div className="rounded-2xl bg-muted/60 p-3">
              <dt className="text-xs text-muted-foreground">{t('detail.price.low')}</dt>
              <dd className="text-lg font-semibold tabular-nums">
                {price.low === null ? '–' : euro(price.low)}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {date
              ? t('detail.price.note', { printId: printing?.printId ?? cardCode, date })
              : t('detail.price.noteNoDate', { printId: printing?.printId ?? cardCode })}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t('detail.price.none')}</p>
      )}
    </section>
  )
}
