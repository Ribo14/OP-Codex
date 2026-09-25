import { ChevronDown, MessageCircleQuestion } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { CardFaq } from './catalog-data'
import { faqSourceLabel } from './faq-source'

// FAQ ufficiali nel dettaglio Card (RIB-44): chiuse di default, testo originale in inglese con la
// fonte. Solo testo (React fa l'escape), come il resto dei testi ufficiali.

export function CardFaqs({ faqs }: { faqs: readonly CardFaq[] }) {
  const { t } = useTranslation()
  if (faqs.length === 0) return null
  return (
    <details className="group rounded-2xl border">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-muted/50 focus-visible:bg-muted focus-visible:outline-none [&::-webkit-details-marker]:hidden">
        <MessageCircleQuestion className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1 text-sm font-medium">{t('detail.faq.title')}</span>
        <span className="text-xs text-muted-foreground">
          {t('detail.faq.count', { count: faqs.length })}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className="space-y-4 px-4 pt-1 pb-4">
        <p className="text-xs text-muted-foreground">{t('detail.faq.intro')}</p>
        <ol className="space-y-4">
          {faqs.map((faq, index) => (
            <li
              key={index}
              className="space-y-1.5 border-t pt-4 first:border-0 first:pt-0"
              lang="en"
            >
              <p className="text-sm leading-relaxed font-medium whitespace-pre-line">
                {faq.question}
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
                {faq.answer}
              </p>
              <p className="text-[11px] text-muted-foreground" lang="it">
                {t('detail.faq.source', { source: faqSourceLabel(faq.source) })}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </details>
  )
}
