import { cardImageUrl } from './card-image'
import type { SetPrinting } from './display-printings'

// Proporzioni delle immagini ufficiali (600×838): riservano lo spazio prima del caricamento.
const IMAGE_WIDTH = 600
const IMAGE_HEIGHT = 838

export function CardGrid({ printings }: { printings: readonly SetPrinting[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {printings.map((printing) => (
        <li key={printing.cardCode}>
          <figure className="flex flex-col gap-1">
            <img
              src={cardImageUrl(printing.printId)}
              alt={printing.name}
              width={IMAGE_WIDTH}
              height={IMAGE_HEIGHT}
              loading="lazy"
              decoding="async"
              className="h-auto w-full rounded-md bg-muted"
            />
            <figcaption className="truncate text-xs text-muted-foreground">
              {printing.cardCode} · {printing.name}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  )
}
