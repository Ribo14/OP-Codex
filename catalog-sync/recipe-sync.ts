import type postgres from 'postgres'

// Composizione dei mazzi pronti (Starter Deck) nel database, dal file versionato
// catalog-sync/decks/starter-decks.json. Il file si controlla prima di scrivere: ogni mazzo ha un
// solo Leader e 50 carte (51 in tutto), quantità da 1 a 4, Card Code validi.

export interface RecipeFile {
  source: string
  decks: Record<string, Record<string, number>>
}

const SET_CODE = /^[A-Z0-9]+(-[A-Z0-9]+)*$/
const CARD_CODE = /^[A-Z0-9]+-[0-9]+$/
/** Leader + 50 carte. */
export const DECK_TOTAL = 51

/** Controlla il file; restituisce l'elenco dei problemi (vuoto se va bene). */
export function checkRecipes(file: unknown): string[] {
  const problems: string[] = []
  if (typeof file !== 'object' || file === null) return ['il file non è un oggetto']
  // Il file arriva da JSON.parse: si controlla tutto, niente è garantito.
  const { source, decks } = file as { source?: unknown; decks?: unknown }
  if (typeof source !== 'string' || source.trim() === '') problems.push('manca "source"')
  if (typeof decks !== 'object' || decks === null) return [...problems, 'manca "decks"']
  for (const [setCode, cards] of Object.entries(decks as Record<string, unknown>)) {
    if (!SET_CODE.test(setCode)) problems.push(`${setCode}: codice del Set non valido`)
    if (typeof cards !== 'object' || cards === null) {
      problems.push(`${setCode}: composizione non valida`)
      continue
    }
    let total = 0
    for (const [cardCode, quantity] of Object.entries(cards as Record<string, unknown>)) {
      if (!CARD_CODE.test(cardCode)) problems.push(`${setCode}: Card Code ${cardCode} non valido`)
      if (
        typeof quantity !== 'number' ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 4
      ) {
        problems.push(`${setCode}: ${cardCode} ha ${String(quantity)} copie`)
      } else total += quantity
    }
    if (total !== DECK_TOTAL) {
      problems.push(`${setCode}: ${String(total)} carte invece di ${String(DECK_TOTAL)}`)
    }
  }
  return problems
}

export interface RecipeSyncStats {
  decks: number
  inserted: number
  updated: number
  removed: number
}

/** Allinea set_recipes al file (anche togliendo i mazzi spariti). Dentro una transazione. */
export async function upsertRecipes(
  tx: postgres.TransactionSql,
  file: RecipeFile,
): Promise<RecipeSyncStats> {
  const rows = Object.entries(file.decks).map(([set_code, cards]) => ({
    set_code,
    cards,
    source: file.source,
  }))
  const result = await tx<{ inserted: boolean }[]>`
    insert into public.set_recipes as r (set_code, cards, source)
    select * from jsonb_to_recordset(${tx.json(rows)}::jsonb)
      as x(set_code text, cards jsonb, source text)
    on conflict (set_code) do update set
      cards = excluded.cards,
      source = excluded.source,
      updated_at = now()
    where (r.cards, r.source) is distinct from (excluded.cards, excluded.source)
    returning (xmax = 0) as inserted
  `
  const removed = await tx`
    delete from public.set_recipes where set_code <> all(${rows.map((r) => r.set_code)}::text[])
    returning 1
  `
  return {
    decks: rows.length,
    inserted: result.filter((r) => r.inserted).length,
    updated: result.filter((r) => !r.inserted).length,
    removed: removed.length,
  }
}
