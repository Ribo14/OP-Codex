import type postgres from 'postgres'

// Card Explanation (RIB-52, ADR-0006): dai file del repo (catalog-sync/explanations/*.json, uno
// per Set) al database. I testi li scrive Claude nelle sessioni di sviluppo e li rivede l'Admin:
// qui si controlla solo che i file siano sani prima di caricarli.

/** Una voce di un file: il Card Code e la spiegazione in markdown semplice. */
export interface ExplanationEntry {
  cardCode: string
  body: string
}

export const MAX_EXPLANATION_LENGTH = 4000
const CARD_CODE = /^[A-Z0-9]+-[0-9]+$/

/**
 * Le spiegazioni di tutti i file, per Card Code, con i problemi trovati (file che non è un
 * elenco, Card Code non valido o ripetuto, testo vuoto o troppo lungo). Con problemi non si carica
 * niente: meglio un job fallito che un testo sbagliato nell'app.
 */
export function collectExplanations(files: readonly { name: string; content: unknown }[]): {
  byCard: Map<string, string>
  problems: string[]
} {
  const byCard = new Map<string, string>()
  const problems: string[] = []
  for (const file of files) {
    if (!Array.isArray(file.content)) {
      problems.push(`${file.name}: non è un elenco`)
      continue
    }
    file.content.forEach((item: unknown, index) => {
      const where = `${file.name} #${String(index + 1)}`
      const { cardCode, body } = (item ?? {}) as Partial<Record<keyof ExplanationEntry, unknown>>
      if (typeof cardCode !== 'string' || !CARD_CODE.test(cardCode)) {
        problems.push(`${where}: Card Code non valido`)
        return
      }
      if (typeof body !== 'string' || body.trim() === '') {
        problems.push(`${where} (${cardCode}): testo vuoto`)
        return
      }
      if (body.length > MAX_EXPLANATION_LENGTH) {
        problems.push(
          `${where} (${cardCode}): testo oltre ${String(MAX_EXPLANATION_LENGTH)} caratteri`,
        )
        return
      }
      if (byCard.has(cardCode)) {
        problems.push(`${where}: ${cardCode} ripetuto`)
        return
      }
      byCard.set(cardCode, body.trim())
    })
  }
  return { byCard, problems }
}

export interface ExplanationUpsertStats {
  cards: number
  inserted: number
  updated: number
  /** Carte non più nei file (restano con il testo vuoto). */
  emptied: number
}

/**
 * Salva le spiegazioni: aggiorna solo quelle cambiate (rilanciare senza novità non tocca nulla,
 * così l'app non riscarica niente) e svuota quelle tolte dai file. Va chiamata in una transazione.
 */
export async function upsertExplanations(
  tx: postgres.TransactionSql,
  byCard: ReadonlyMap<string, string>,
): Promise<ExplanationUpsertStats> {
  const rows = [...byCard].map(([card_code, body]) => ({ card_code, body }))
  const stats: ExplanationUpsertStats = { cards: rows.length, inserted: 0, updated: 0, emptied: 0 }
  if (rows.length > 0) {
    const result = await tx<{ inserted: boolean }[]>`
      insert into public.card_explanations as e (card_code, body)
      select r.card_code, r.body
      from jsonb_to_recordset(${tx.json(rows)}::jsonb) as r(card_code text, body text)
      on conflict (card_code) do update set body = excluded.body, updated_at = now()
      where e.body is distinct from excluded.body
      returning (xmax = 0) as inserted
    `
    for (const row of result) {
      if (row.inserted) stats.inserted++
      else stats.updated++
    }
  }
  const emptied = await tx`
    update public.card_explanations set body = '', updated_at = now()
    where body <> '' and not (card_code = any(${[...byCard.keys()]}::text[]))
  `
  stats.emptied = emptied.count
  return stats
}
