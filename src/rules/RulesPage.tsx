import { ExternalLink, Search } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { cn } from '@/lib/utils'
import { GLOSSARY, GLOSSARY_GROUPS, type GlossaryEntry } from './glossary'
import { ENTRY_PARAM, SEARCH_PARAM } from './paths'

// Sezione Regole (RIB-51): il glossario delle Keyword e dei concetti di regola, nel bundle
// dell'app e quindi anche offline. Con ?voce=<id> la voce si evidenzia e si porta in vista
// (ci si arriva toccando una Keyword nel dettaglio di una Card).

const OFFICIAL_RULES_URL = 'https://en.onepiece-cardgame.com/rules/'

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function matches(entry: GlossaryEntry, words: readonly string[]): boolean {
  const text = normalize([entry.term, entry.summary, ...entry.body].join('\n'))
  return words.every((w) => text.includes(w))
}

export function RulesPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const query = params.get(SEARCH_PARAM) ?? ''
  const selected = params.get(ENTRY_PARAM)

  const words = normalize(query).split(/\s+/).filter(Boolean)
  const entries = useMemo(
    () => GLOSSARY.filter((entry) => entry.id === selected || matches(entry, words)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `words` deriva da `query`
    [query, selected],
  )

  // Al frame dopo: la shell riporta in cima la pagina quando si cambia sezione, dopo questo effetto.
  useEffect(() => {
    if (!selected) return
    const frame = requestAnimationFrame(() => {
      document.getElementById(`voce-${selected}`)?.scrollIntoView({ block: 'center' })
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [selected])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{t('rules.title')}</h1>
        <p className="text-muted-foreground">{t('rules.intro')}</p>
        <a
          href={OFFICIAL_RULES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2"
        >
          {t('rules.official')}
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      </header>

      <label className="flex h-11 items-center gap-2 rounded-full bg-muted px-4 text-sm">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{t('rules.search')}</span>
        <input
          type="search"
          value={query}
          placeholder={t('rules.search')}
          onChange={(e) => {
            const next = new URLSearchParams()
            if (e.target.value) next.set(SEARCH_PARAM, e.target.value)
            setParams(next, { replace: true })
          }}
          className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
      </label>

      {entries.length === 0 && <p className="text-muted-foreground">{t('rules.noResults')}</p>}

      {GLOSSARY_GROUPS.map((group) => {
        const list = entries.filter((e) => e.group === group)
        if (list.length === 0) return null
        return (
          <section key={group} aria-labelledby={`gruppo-${group}`} className="space-y-3">
            <h2
              id={`gruppo-${group}`}
              className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
            >
              {t(`rules.groups.${group}`)}
            </h2>
            <div className="space-y-3">
              {list.map((entry) => (
                <article
                  key={entry.id}
                  id={`voce-${entry.id}`}
                  aria-labelledby={`titolo-${entry.id}`}
                  className={cn(
                    'scroll-mt-24 rounded-2xl border p-4',
                    entry.id === selected && 'border-foreground ring-1 ring-foreground',
                  )}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <h3 id={`titolo-${entry.id}`} className="font-semibold">
                      {entry.group === 'concept' ? entry.term : `[${entry.term}]`}
                    </h3>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t('rules.rule', { rule: entry.rule })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium">{entry.summary}</p>
                  <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
                    {entry.body.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
