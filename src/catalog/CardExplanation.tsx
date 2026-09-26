import { Lightbulb } from 'lucide-react'
import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { KeywordText } from '@/rules/KeywordText'
import { parseExplanation, type Inline } from './explanation-markdown'

// Card Explanation nel dettaglio Card (RIB-52, ADR-0006): sotto il testo ufficiale, ben distinta
// da quello. Markdown semplice reso con elementi React (tutto testo, React fa l'escape); le
// Keyword tra [ ] portano al glossario come nel testo ufficiale.

function InlineText({ parts }: { parts: readonly Inline[] }) {
  return (
    <>
      {parts.map((part, i) =>
        part.bold ? (
          // I pezzi non cambiano ordine: l'indice basta come chiave.
          <strong key={i} className="font-semibold text-foreground">
            <KeywordText text={part.text} />
          </strong>
        ) : (
          <KeywordText key={i} text={part.text} />
        ),
      )}
    </>
  )
}

export function CardExplanation({ markdown }: { markdown: string | null | undefined }) {
  const { t } = useTranslation()
  const blocks = markdown ? parseExplanation(markdown) : []
  if (blocks.length === 0) return null
  return (
    <section aria-labelledby="spiegazione-titolo" className="space-y-3 rounded-2xl bg-muted/60 p-4">
      <div className="flex items-center gap-2">
        <Lightbulb className="size-4 shrink-0" aria-hidden="true" />
        <h3 id="spiegazione-titolo" className="text-sm font-semibold">
          {t('detail.explanation.title')}
        </h3>
      </div>
      <div className="space-y-3 text-sm leading-relaxed">
        {blocks.map((block, i) =>
          block.kind === 'list' ? (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>
                  <InlineText parts={item} />
                </li>
              ))}
            </ul>
          ) : (
            <p key={i}>
              {block.lines.map((line, j) => (
                <Fragment key={j}>
                  {j > 0 && <br />}
                  <InlineText parts={line} />
                </Fragment>
              ))}
            </p>
          ),
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('detail.explanation.disclaimer')}</p>
    </section>
  )
}
