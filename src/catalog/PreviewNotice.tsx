import { Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { CatalogCard } from './catalog-data'

/** Sito da cui arrivano le anteprime (ADR-0016): lo si cita sempre. */
export const PREVIEW_SOURCE_URL = 'https://optcgleaks.com/'

/** Etichetta "Anteprima" sulle miniature delle carte non ancora uscite (ADR-0016). */
export function PreviewBadge({ className }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-sky-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow',
        className,
      )}
    >
      <Eye className="size-3" aria-hidden="true" />
      {t('preview.badge')}
    </span>
  )
}

/** Nel dettaglio: da dove arrivano i dati, chi li ha tradotti, cosa succede all'uscita. */
export function PreviewNotice({ card }: { card: CatalogCard }) {
  const { t } = useTranslation()
  return (
    <section
      aria-label={t('preview.title')}
      className="space-y-1 rounded-2xl border border-sky-600/30 bg-sky-600/10 p-4 text-sm"
    >
      <p className="flex items-center gap-2 font-semibold text-sky-800 dark:text-sky-300">
        <Eye className="size-4" aria-hidden="true" />
        {t('preview.title')}
      </p>
      <p>
        {t('preview.text')}{' '}
        <a
          href={PREVIEW_SOURCE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline underline-offset-2"
        >
          {t('preview.source')}
        </a>
        {card.previewCredit ? ` · ${t('preview.credit', { name: card.previewCredit })}` : ''}
      </p>
      <p className="text-xs text-muted-foreground">{t('preview.noCollection')}</p>
    </section>
  )
}
