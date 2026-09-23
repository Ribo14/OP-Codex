import { getSupabase } from '@/lib/supabase'
import type { SetPrinting } from './display-printings'

export interface CatalogSet {
  seriesId: number
  code: string
  name: string
}

export async function fetchSets(): Promise<CatalogSet[]> {
  const { data, error } = await getSupabase()
    .from('sets')
    .select('series_id, code, name')
    .order('code')
  if (error) throw new Error(error.message)
  return data.map((row) => ({ seriesId: row.series_id, code: row.code, name: row.name }))
}

export async function fetchSetPrintings(seriesId: number): Promise<SetPrinting[]> {
  const { data, error } = await getSupabase()
    .from('printings')
    .select('print_id, card_code, cards(name)')
    .eq('series_id', seriesId)
    .order('print_id')
  if (error) throw new Error(error.message)
  return data.map((row) => ({
    printId: row.print_id,
    cardCode: row.card_code,
    name: row.cards.name,
  }))
}
