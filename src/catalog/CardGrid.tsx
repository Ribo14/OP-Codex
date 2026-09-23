import { cardImageUrl } from './card-image'
import type { SetPrinting } from './display-printings'

// Proporzioni della miniatura (300×419): riservano lo spazio prima del caricamento.
const THUMB_WIDTH = 300
const THUMB_HEIGHT = 419

export function CardGrid({ printings }: { printings: readonly SetPrinting[] }) {
  return (
    <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
      {printings.map((printing) => (
        <li key={printing.cardCode}>
          <figure className="flex flex-col gap-1">
            {printing.hasImage ? (
              <img
                src={cardImageUrl(printing.printId, 'thumb')}
                alt={printing.name}
                width={THUMB_WIDTH}
                height={THUMB_HEIGHT}
                loading="lazy"
                decoding="async"
                className="h-auto w-full rounded-md bg-muted"
              />
            ) : (
              <div
                role="img"
                aria-label={`${printing.name}: immagine non ancora disponibile`}
                className="flex aspect-[300/419] w-full items-center justify-center rounded-md bg-muted p-2 text-center text-xs text-muted-foreground"
              >
                {printing.name}
              </div>
            )}
            <figcaption className="truncate text-xs text-muted-foreground">
              {printing.cardCode} · {printing.name}
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  )
}
