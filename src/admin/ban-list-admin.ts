import type { BanListEntry } from '@/catalog/ban-list'
import { getSupabase } from '@/lib/supabase'

// Gestione della Ban List dall'area Admin (RIB-29). Il database accetta le scritture solo
// dall'Admin attivo e registra ogni modifica (ADR-0014).

export interface BanDraft {
  cardCode: string
  kind: BanListEntry['kind']
  maxCopies: number | null
  pairCode: string | null
  effectiveFrom: string
  source: string
}

export type DraftProblem = 'code' | 'pairCode' | 'samePair' | 'maxCopies' | 'date'

const CODE = /^[A-Z0-9]+-[0-9]+$/

/**
 * Controlla e normalizza una voce prima di salvarla: codici in maiuscolo, i campi che non
 * servono al tipo svuotati, le due carte di una coppia in ordine (come vuole il database).
 */
export function normalizeDraft(draft: BanDraft): BanDraft | DraftProblem {
  const cardCode = draft.cardCode.trim().toUpperCase()
  const pairCode = draft.pairCode?.trim().toUpperCase() ?? ''
  if (!CODE.test(cardCode)) return 'code'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.effectiveFrom)) return 'date'
  const base = {
    effectiveFrom: draft.effectiveFrom,
    source: draft.source.trim(),
    kind: draft.kind,
  }
  if (draft.kind === 'restricted') {
    const max = draft.maxCopies
    if (max === null || !Number.isInteger(max) || max < 0 || max > 3) return 'maxCopies'
    return { ...base, cardCode, maxCopies: max, pairCode: null }
  }
  if (draft.kind === 'pair') {
    if (!CODE.test(pairCode)) return 'pairCode'
    if (pairCode === cardCode) return 'samePair'
    const [a, b] = cardCode < pairCode ? [cardCode, pairCode] : [pairCode, cardCode]
    return { ...base, cardCode: a, maxCopies: null, pairCode: b }
  }
  return { ...base, cardCode, maxCopies: null, pairCode: null }
}

const row = (d: BanDraft) => ({
  card_code: d.cardCode,
  kind: d.kind,
  max_copies: d.maxCopies,
  pair_code: d.pairCode,
  effective_from: d.effectiveFrom,
  source: d.source || null,
})

function fail(error: { message: string; code?: string } | null): void {
  if (error) throw Object.assign(new Error(error.message), { code: error.code })
}

export async function insertBanEntry(draft: BanDraft): Promise<void> {
  const { error } = await getSupabase().from('ban_list_entries').insert(row(draft))
  fail(error)
}

export async function updateBanEntry(id: number, draft: BanDraft): Promise<void> {
  const { error } = await getSupabase().from('ban_list_entries').update(row(draft)).eq('id', id)
  fail(error)
}

export async function deleteBanEntry(id: number): Promise<void> {
  const { error } = await getSupabase().from('ban_list_entries').delete().eq('id', id)
  fail(error)
}
