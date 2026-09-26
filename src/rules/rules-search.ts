import type { CardFaq, CatalogCard } from '@/catalog/catalog-data'
import { parentOf, type Rule } from './rules-text'

// Rules Search (RIB-53): ricerca nel regolamento e nelle FAQ ufficiali, sul dispositivo. Testo
// ufficiale in inglese: tutte le parole devono comparire, senza badare a maiuscole e accenti.

export const normalize = (text: string) =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toLowerCase()

export function searchWords(query: string): string[] {
  return normalize(query).split(/\s+/).filter(Boolean)
}

const RULE_NUMBER = /^\d+(-\d+)*\.?$/

/**
 * Le regole che contengono tutte le parole, nell'ordine del regolamento. Un numero di regola
 * ("10-1-4" o "10-1-4.") trova quella regola e le sue sotto-regole.
 */
export function searchRules(rules: readonly Rule[], query: string): Rule[] {
  const trimmed = query.trim()
  if (RULE_NUMBER.test(trimmed)) {
    const n = trimmed.replace(/\.$/, '')
    return rules.filter((r) => r.n === n || r.n.startsWith(`${n}-`))
  }
  const words = searchWords(query)
  if (words.length === 0) return []
  return rules.filter((r) => {
    const text = normalize(r.t)
    return words.every((w) => text.includes(w))
  })
}

export interface FaqHit {
  card: CatalogCard
  faq: CardFaq
}

/** Le FAQ ufficiali che contengono tutte le parole (domanda, risposta, nome o codice della carta). */
export function searchFaqs(cards: readonly CatalogCard[], query: string): FaqHit[] {
  const words = searchWords(query)
  if (words.length === 0) return []
  const hits: FaqHit[] = []
  for (const card of cards) {
    for (const faq of card.faqs ?? []) {
      const text = normalize(`${card.cardCode} ${card.name}\n${faq.question}\n${faq.answer}`)
      if (words.every((w) => text.includes(w))) hits.push({ card, faq })
    }
  }
  return hits
}

/** I titoli sopra una regola, dal capitolo in giù: "10" → "10-1" → "10-1-4". */
export function ancestorsOf(rules: readonly Rule[], n: string): Rule[] {
  const chain: Rule[] = []
  for (let p = parentOf(n); p !== null; p = parentOf(p)) {
    const rule = rules.find((r) => r.n === p)
    if (rule) chain.unshift(rule)
  }
  return chain
}

/**
 * Il contesto in cui mostrare una regola: il suo genitore con tutte le sotto-regole (le regole
 * vicine), oppure la regola stessa con le sue, se è un capitolo.
 */
export function ruleContext(rules: readonly Rule[], n: string): Rule[] {
  const root = parentOf(n) ?? n
  return rules.filter((r) => r.n === root || r.n.startsWith(`${root}-`))
}

/** Il testo diviso in pezzi, segnando quelli che corrispondono a una parola cercata. */
export function highlight(
  text: string,
  words: readonly string[],
): { text: string; hit: boolean }[] {
  if (words.length === 0) return [{ text, hit: false }]
  const lower = normalize(text)
  const marks = new Array<boolean>(text.length).fill(false)
  for (const word of words) {
    for (let i = lower.indexOf(word); i !== -1; i = lower.indexOf(word, i + word.length)) {
      marks.fill(true, i, i + word.length)
    }
  }
  const parts: { text: string; hit: boolean }[] = []
  for (let i = 0; i < text.length; i++) {
    const hit = marks[i] ?? false
    const last = parts.at(-1)
    if (last?.hit === hit) last.text += text[i] ?? ''
    else parts.push({ text: text[i] ?? '', hit })
  }
  return parts
}
