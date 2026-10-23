import { Eye } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CatalogCard } from './catalog-data'

/** Sito da cui arrivano le anteprime (ADR-0016): lo si cita sempre. */
export const PREVIEW_SOURCE_URL = 'https://optcgleaks.com/'

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
