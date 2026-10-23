import { useTranslation } from 'react-i18next'
import type { CatalogCard } from '@/catalog/catalog-data'
import { CardExplanation } from '@/catalog/CardExplanation'
import { CardFaqs } from '@/catalog/CardFaqs'
import { KeywordText } from '@/rules/KeywordText'

// Info di una carta durante la partita (RIB-101): la griglia dei dati come nell'app ufficiale,
// il testo inglese di effetto e Trigger, la spiegazione in italiano e le FAQ ufficiali.

export function CardInfo({ card }: { card: CatalogCard | undefined }) {
  const { t } = useTranslation()
  if (!card) return null
  const dash = '–'
  const rows: [string, string][] = [
    [t('detail.colors'), card.colors.join('/') || dash],
    [t('detail.category'), t(`category.${card.category as 'Leader'}`)],
    card.life !== null
      ? [t('detail.life'), String(card.life)]
      : [t('detail.cost'), card.cost === null ? dash : String(card.cost)],
    [t('detail.power'), card.power === null ? dash : String(card.power)],
    [t('detail.counter'), card.counter === null ? dash : `+${String(card.counter)}`],
    [t('detail.attributes'), card.attributes.join('/') || dash],
  ]
  return (
    <div className="space-y-3 text-xs">
      <p className="text-muted-foreground">
        {card.cardCode}
        {card.types.length > 0 && ` · ${card.types.join('/')}`}
      </p>
      <dl className="grid grid-cols-2 gap-1">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-muted/60 px-2 py-1">
            <dt className="text-[10px] text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {card.effect === null && card.trigger === null && (
        <p className="text-muted-foreground">{t('detail.noEffect')}</p>
      )}
      {card.effect !== null && (
        <section className="space-y-1">
          <h3 className="font-semibold">{t('detail.effect')}</h3>
          <p className="leading-relaxed">
            <KeywordText text={card.effect} />
          </p>
        </section>
      )}
      {card.trigger !== null && (
        <section className="space-y-1">
          <h3 className="font-semibold">{t('detail.trigger')}</h3>
          <p className="leading-relaxed">
            <KeywordText text={card.trigger} />
          </p>
        </section>
      )}
      <CardExplanation markdown={card.explanation} />
      <CardFaqs faqs={card.faqs ?? []} />
    </div>
  )
}
