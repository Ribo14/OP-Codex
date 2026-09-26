// Comprehensive Rules in testo strutturato (RIB-53): dal testo del PDF (pdftotext -layout) a un
// elenco di regole numerate, per la Rules Search. Solo lo script di estrazione usa parseRulesText;
// l'app legge il JSON già pronto (src/rules/comprehensive-rules.json).

export interface Rule {
  /** Numero della regola: "10-1-4-1"; i capitoli sono "10". */
  n: string
  /** Testo della regola (per capitoli e sezioni è il titolo). */
  t: string
}

export interface RulesDocument {
  version: string
  updated: string
  rules: Rule[]
}

const NUMBERED = /^\s*(\d+(?:-\d+)*)\.\s+(\S.*)$/
// Refusi dei titoli nel PDF 1.2.1: "2-13 Rarity" (senza punto) e "8.4. Activation…" (punto al
// posto del trattino). Solo numeri con almeno due parti e titolo con la maiuscola.
const NUMBERED_TYPO = /^\s*(\d+(?:[-.]\d+)+)\.?\s+([A-Z].*)$/
const PAGE_NUMBER = /^\s*\d+\s*$/
const TOC_LINE = /\.{5,}/

const chapterOf = (n: string) => Number(n.split('-')[0])

export function parseRulesText(text: string): RulesDocument {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const version = /Version\s+([\d.]+)/.exec(text)?.[1] ?? ''
  const updated = /Last updated:\s*([\d/]+)/.exec(text)?.[1] ?? ''

  const rules: Rule[] = []
  let chapter = 0
  for (const raw of lines) {
    if (raw.trim() === '' || PAGE_NUMBER.test(raw) || TOC_LINE.test(raw)) continue
    const match = NUMBERED.exec(raw) ?? NUMBERED_TYPO.exec(raw)
    const n = match?.[1]?.replaceAll('.', '-')
    // Un numero a inizio riga è una regola nuova solo se sta nel capitolo corrente o nel
    // successivo: così i rimandi andati a capo ("… (see 6-6-1-" / "1.)") restano testo.
    if (match && n && (chapterOf(n) === chapter || chapterOf(n) === chapter + 1)) {
      chapter = chapterOf(n)
      rules.push({ n, t: (match[2] ?? '').trim() })
      continue
    }
    const last = rules.at(-1)
    if (!last) continue
    const line = raw.trim()
    // "… return to 4-5-" + "4-1." oppure "face-" + "up": il trattino a fine riga unisce senza spazio.
    last.t = /[-−]$/.test(last.t) && /^[\d\w]/.test(line) ? `${last.t}${line}` : `${last.t} ${line}`
  }
  for (const rule of rules) rule.t = rule.t.replace(/\s{2,}/g, ' ')
  return { version, updated, rules }
}

/** Il genitore di una regola ("10-1-4-1" → "10-1-4"), null per i capitoli. */
export function parentOf(n: string): string | null {
  const i = n.lastIndexOf('-')
  return i === -1 ? null : n.slice(0, i)
}
