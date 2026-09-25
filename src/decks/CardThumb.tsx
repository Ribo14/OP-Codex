import { useTranslation } from 'react-i18next'
import { cardImageUrl } from '@/catalog/card-image'
import type { CatalogPrinting } from '@/catalog/catalog-data'
import { cn } from '@/lib/utils'

/**
 * Miniatura di una Printing (o il nome, se l'immagine non è ancora disponibile). Proporzioni
 * della carta sempre fisse e niente allungamento accanto a un testo più alto (self-start):
 * altrimenti in una riga flex il Leader veniva stirato in altezza e sembrava schiacciato.
 */
export function CardThumb({
  printing,
  name,
  className,
}: {
  printing: CatalogPrinting | undefined
  name: string
  className?: string
}) {
  const { t } = useTranslation()
  if (!printing?.hasImage) {
    return (
      <div
        role="img"
        aria-label={t('catalog.imagePending', { name })}
        className={cn(
          'flex aspect-[300/419] items-center justify-center self-start rounded-md bg-muted p-1 text-center text-[9px] leading-tight text-muted-foreground',
          className,
        )}
      >
        {name}
      </div>
    )
  }
  return (
    <img
      src={cardImageUrl(printing.printId, 'thumb')}
      crossOrigin="anonymous"
      alt={name}
      width={300}
      height={419}
      loading="lazy"
      decoding="async"
      className={cn(
        'aspect-[300/419] h-auto self-start rounded-md bg-muted object-cover',
        className,
      )}
    />
  )
}
