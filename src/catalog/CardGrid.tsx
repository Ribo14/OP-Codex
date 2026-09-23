import { useTranslation } from 'react-i18next'
import { cardImageUrl } from './card-image'
import type { SetPrinting } from './display-printings'

// Proporzioni della miniatura (300×419): riservano lo spazio prima del caricamento.
const THUMB_WIDTH = 300
const THUMB_HEIGHT = 419

export function CardGrid({ printings }: { printings: readonly SetPrinting[] }) {
  const { t } = useTranslation()
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-6 2xl:grid-cols-6">
      {printings.map((printing) => (
        <li key={printing.cardCode}>
          <figure className="flex flex-col gap-2">
            {printing.hasImage ? (
              <img
                src={cardImageUrl(printing.printId, 'thumb')}
                alt={printing.name}
                width={THUMB_WIDTH}
                height={THUMB_HEIGHT}
                loading="lazy"
                decoding="async"
                className="h-auto w-full rounded-xl bg-muted shadow-sm"
              />
            ) : (
              <div
                role="img"
                aria-label={t('catalog.imagePending', { name: printing.name })}
                className="flex aspect-[300/419] w-full items-center justify-center rounded-xl bg-muted p-2 text-center text-xs text-muted-foreground"
              >
                {printing.name}
              </div>
            )}
            <figcaption className="min-w-0">
              <span className="block truncate text-sm font-medium">{printing.name}</span>
              <span className="block text-xs text-muted-foreground">{printing.cardCode}</span>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  )
}
