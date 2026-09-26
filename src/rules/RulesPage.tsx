import { ArrowLeft, ExternalLink, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { cardPath } from '@/catalog/card-links'
import { useCatalog } from '@/catalog/local-catalog'
import { cn } from '@/lib/utils'
import { GLOSSARY, GLOSSARY_GROUPS, type GlossaryEntry } from './glossary'
import { ENTRY_PARAM, RULE_PARAM, rulePath, SEARCH_PARAM } from './paths'
import {
  ancestorsOf,
  highlight,
  normalize,
  ruleContext,
  searchFaqs,
  searchRules,
  searchWords,
} from './rules-search'
import type { Rule, RulesDocument } from './rules-text'
import { useRulesDocument } from './use-rules'

// Sezione Regole: glossario (RIB-51) e Rules Search (RIB-53). Senza ricerca si vede il
// glossario; con una ricerca, glossario, regolamento e FAQ ufficiali che corrispondono. Con
// ?regola=<numero> si legge una regola nel suo contesto. Tutto sul dispositivo, anche offline.

const OFFICIAL_RULES_URL = 'https://en.onepiece-cardgame.com/rules/'

/** "8/28/2026" (come nel PDF, all'americana) → "28/08/2026". */
function italianDate(us: string): string {
  const [month, day, year] = us.split('/')
  return month && day && year ? `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}` : us
}
const PAGE = 20

function glossaryMatches(entry: GlossaryEntry, words: readonly string[]): boolean {
  const text = normalize([entry.term, entry.summary, ...entry.body].join('\n'))
  return words.every((w) => text.includes(w))
}

export function RulesPage() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const query = params.get(SEARCH_PARAM) ?? ''
  const ruleNumber = params.get(RULE_PARAM)
  const doc = useRulesDocument()

  const search = (value: string) => {
    const next = new URLSearchParams()
    if (value) next.set(SEARCH_PARAM, value)
    setParams(next, { replace: true })
  }

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

      {ruleNumber ? (
        <RuleView n={ruleNumber} doc={doc} />
      ) : (
        <>
          <label className="flex h-11 items-center gap-2 rounded-full bg-muted px-4 text-sm">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">{t('rules.search')}</span>
            <input
              type="search"
              value={query}
              placeholder={t('rules.search')}
              onChange={(e) => {
                search(e.target.value)
              }}
              className="w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
          </label>
          {query.trim() ? (
            <SearchResults query={query} doc={doc} />
          ) : (
            <Glossary entries={GLOSSARY} selected={params.get(ENTRY_PARAM)} />
          )}
        </>
      )}
    </div>
  )
}

function Glossary({
  entries,
  selected,
  words = [],
}: {
  entries: readonly GlossaryEntry[]
  selected: string | null
  words?: readonly string[]
}) {
  const { t } = useTranslation()

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
    <>
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
                    {/* Il numero di regola apre la regola ufficiale (RIB-53). */}
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {t('rules.rulePrefix')}{' '}
                      {entry.rule.split(', ').map((n, i) => (
                        <span key={n}>
                          {i > 0 && ', '}
                          <Link to={rulePath(n)} className="underline underline-offset-2">
                            {n}
                          </Link>
                        </span>
                      ))}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium">
                    <Marked text={entry.summary} words={words} />
                  </p>
                  <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">
                    {entry.body.map((paragraph) => (
                      <p key={paragraph}>
                        <Marked text={paragraph} words={words} />
                      </p>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )
      })}
    </>
  )
}

function Marked({ text, words }: { text: string; words: readonly string[] }) {
  return (
    <>
      {highlight(text, words).map((part, i) =>
        part.hit ? (
          // I pezzi non cambiano ordine: l'indice basta come chiave.
          <mark key={i} className="rounded-sm bg-amber-200/70 text-inherit dark:bg-amber-400/30">
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  )
}

function SearchResults({ query, doc }: { query: string; doc: RulesDocument | null }) {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const words = searchWords(query)
  const glossary = GLOSSARY.filter((entry) => glossaryMatches(entry, words))
  const rules = useMemo(() => (doc ? searchRules(doc.rules, query) : []), [doc, query])
  const faqs = useMemo(() => (catalog ? searchFaqs(catalog.cards, query) : []), [catalog, query])
  const [ruleLimit, setRuleLimit] = useState(PAGE)
  const [faqLimit, setFaqLimit] = useState(PAGE)

  // Nuova ricerca: si riparte dai primi risultati.
  const [previous, setPrevious] = useState(query)
  if (previous !== query) {
    setPrevious(query)
    setRuleLimit(PAGE)
    setFaqLimit(PAGE)
  }

  const nothing = glossary.length === 0 && rules.length === 0 && faqs.length === 0
  return (
    <div className="space-y-8">
      {nothing && doc && <p className="text-muted-foreground">{t('rules.noResults')}</p>}

      {glossary.length > 0 && <Glossary entries={glossary} selected={null} words={words} />}

      {rules.length > 0 && (
        <section aria-labelledby="risultati-regole" className="space-y-3">
          <h2
            id="risultati-regole"
            className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            {t('rules.rulesResults', { count: rules.length })}
          </h2>
          <ul className="divide-y rounded-2xl border">
            {rules.slice(0, ruleLimit).map((rule) => (
              <li key={rule.n}>
                <Link
                  to={rulePath(rule.n)}
                  className="block space-y-1 px-4 py-3 hover:bg-muted/50"
                  lang="en"
                >
                  <span className="text-xs font-medium text-muted-foreground tabular-nums">
                    {rule.n}
                  </span>
                  <p className="line-clamp-3 text-sm leading-relaxed">
                    <Marked text={rule.t} words={words} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          {rules.length > ruleLimit && (
            <MoreButton
              onClick={() => {
                setRuleLimit((l) => l + PAGE)
              }}
            />
          )}
        </section>
      )}

      {faqs.length > 0 && (
        <section aria-labelledby="risultati-faq" className="space-y-3">
          <h2
            id="risultati-faq"
            className="px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            {t('rules.faqResults', { count: faqs.length })}
          </h2>
          <ul className="divide-y rounded-2xl border">
            {faqs.slice(0, faqLimit).map(({ card, faq }, i) => (
              // La stessa carta può avere più FAQ: codice e posizione insieme.
              <li key={`${card.cardCode}-${String(i)}`} className="space-y-1.5 px-4 py-3">
                <Link
                  to={cardPath(card.cardCode, new URLSearchParams())}
                  className="text-xs font-medium underline underline-offset-2"
                >
                  {card.cardCode} · {card.name}
                </Link>
                <div lang="en" className="space-y-1 text-sm leading-relaxed">
                  <p className="font-medium">
                    <Marked text={faq.question} words={words} />
                  </p>
                  <p className="text-muted-foreground">
                    <Marked text={faq.answer} words={words} />
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {faqs.length > faqLimit && (
            <MoreButton
              onClick={() => {
                setFaqLimit((l) => l + PAGE)
              }}
            />
          )}
        </section>
      )}
    </div>
  )
}

function MoreButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium hover:bg-muted"
    >
      {t('rules.showMore')}
    </button>
  )
}

/** Una regola nel suo contesto: i titoli sopra e le regole vicine, con quella scelta evidenziata. */
function RuleView({ n, doc }: { n: string; doc: RulesDocument | null }) {
  const { t } = useTranslation()

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      document.getElementById(`regola-${n}`)?.scrollIntoView({ block: 'center' })
    })
    return () => {
      cancelAnimationFrame(frame)
    }
  }, [n, doc])

  const back = (
    <button
      type="button"
      onClick={() => {
        // Dalla ricerca o dal glossario si torna lì; aperta da un link diretto, al glossario.
        if (window.history.length > 1) window.history.back()
      }}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {t('rules.back')}
    </button>
  )
  if (!doc) return <p className="text-muted-foreground">{t('rules.loading')}</p>
  const context = ruleContext(doc.rules, n)
  if (!context.some((r) => r.n === n)) {
    return (
      <div className="space-y-3">
        {back}
        <p role="alert">{t('rules.ruleNotFound', { n })}</p>
      </div>
    )
  }
  const ancestors = ancestorsOf(doc.rules, context[0]?.n ?? n)
  return (
    <div className="space-y-4">
      {back}
      <nav aria-label={t('rules.path')} className="text-xs text-muted-foreground" lang="en">
        {ancestors.map((a) => `${a.n}. ${a.t}`).join(' › ')}
      </nav>
      <ol className="space-y-2" lang="en">
        {context.map((rule) => (
          <RuleLine
            key={rule.n}
            rule={rule}
            depth={rule.n.split('-').length}
            selected={rule.n === n}
          />
        ))}
      </ol>
      <p className="text-xs text-muted-foreground">
        {t('rules.version', { version: doc.version, updated: italianDate(doc.updated) })}
      </p>
    </div>
  )
}

function RuleLine({ rule, depth, selected }: { rule: Rule; depth: number; selected: boolean }) {
  return (
    <li
      id={`regola-${rule.n}`}
      className={cn(
        'scroll-mt-24 rounded-xl px-3 py-2 text-sm leading-relaxed',
        selected && 'bg-amber-100 ring-1 ring-amber-400 dark:bg-amber-400/15',
      )}
      style={{ marginLeft: `${String(Math.max(0, depth - 2) * 0.75)}rem` }}
    >
      <span className="mr-2 font-medium tabular-nums">{rule.n}.</span>
      {rule.t}
    </li>
  )
}
