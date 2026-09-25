import type postgres from 'postgres'

// FAQ ufficiali (RIB-44): dalle righe estratte dai PDF (catalog-sync/faq/faq-raw.json, prodotto da
// scripts/faq/extract_faqs.py) alle FAQ di ogni carta, e poi nel database.

/** Una riga della tabella di un PDF, con il testo così com'è (a capo del PDF compresi). */
export interface RawFaqRow {
  source: string
  page: number
  cardCode: string
  cardName: string
  question: string
  answer: string
}

export interface FaqItem {
  question: string
  answer: string
  /** Il PDF di origine, es. "qa_op05.pdf". */
  source: string
}

/**
 * Testo pulito. Nei PDF gli a capo sono solo quelli della colonna, mentre "<br>" (letterale) e le
 * righe che iniziano con "*" (note) sono veri a capo. Una riga che finisce con un trattino si
 * unisce senza spazio: "−\n2000" → "−2000", "EB03-\n031" → "EB03-031", "face-\nup" → "face-up".
 */
export function cleanFaqText(text: string): string {
  return text
    .split(/<br\s*\/?>/i)
    .map((paragraph) =>
      paragraph
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .reduce((joined, line) => {
          if (joined === '') return line
          if (line.startsWith('*')) return `${joined}\n${line}`
          return /[-−]$/.test(joined) ? `${joined}${line}` : `${joined} ${line}`
        }, ''),
    )
    .filter((paragraph) => paragraph !== '')
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
}

/**
 * Le FAQ di ogni carta, nell'ordine dei PDF. La stessa domanda con la stessa risposta ripetuta in
 * un PDF successivo (succede tra OP16 e OP17) si tiene una volta sola.
 */
export function faqsByCard(rows: readonly RawFaqRow[]): Map<string, FaqItem[]> {
  const byCard = new Map<string, FaqItem[]>()
  for (const row of rows) {
    const item: FaqItem = {
      question: cleanFaqText(row.question),
      answer: cleanFaqText(row.answer),
      source: row.source,
    }
    if (!item.question || !item.answer) continue
    const list = byCard.get(row.cardCode) ?? []
    if (!list.some((f) => f.question === item.question && f.answer === item.answer)) {
      list.push(item)
    }
    byCard.set(row.cardCode, list)
  }
  return byCard
}

export interface FaqUpsertStats {
  cards: number
  questions: number
  inserted: number
  updated: number
  /** Carte che non hanno più FAQ (restano con l'elenco vuoto). */
  emptied: number
}

/**
 * Salva le FAQ: aggiorna solo le carte davvero cambiate (rilanciare senza novità non tocca nulla,
 * così l'app non riscarica niente) e svuota quelle non più presenti. Va chiamata in una transazione.
 */
export async function upsertFaqs(
  tx: postgres.TransactionSql,
  byCard: ReadonlyMap<string, readonly FaqItem[]>,
): Promise<FaqUpsertStats> {
  const rows = [...byCard].map(([card_code, items]) => ({ card_code, items }))
  const stats: FaqUpsertStats = {
    cards: rows.length,
    questions: rows.reduce((sum, r) => sum + r.items.length, 0),
    inserted: 0,
    updated: 0,
    emptied: 0,
  }
  if (rows.length > 0) {
    const result = await tx<{ inserted: boolean }[]>`
      insert into public.card_faqs as f (card_code, items)
      select r.card_code, r.items
      from jsonb_to_recordset(${tx.json(rows as unknown as postgres.JSONValue)}::jsonb)
        as r(card_code text, items jsonb)
      on conflict (card_code) do update set items = excluded.items, updated_at = now()
      where f.items is distinct from excluded.items
      returning (xmax = 0) as inserted
    `
    for (const row of result) {
      if (row.inserted) stats.inserted++
      else stats.updated++
    }
  }
  const emptied = await tx`
    update public.card_faqs set items = '[]'::jsonb, updated_at = now()
    where items <> '[]'::jsonb and not (card_code = any(${[...byCard.keys()]}::text[]))
  `
  stats.emptied = emptied.count
  return stats
}
