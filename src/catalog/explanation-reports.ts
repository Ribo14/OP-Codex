import { getSupabase } from '@/lib/supabase'

// Segnalazioni e richieste di spiegazione (RIB-54). Il database fa i controlli: RLS (solo a
// proprio nome), una voce aperta per carta e tipo, al massimo 10 al giorno, nota fino a 500
// caratteri. Qui si traducono i suoi errori in problemi da mostrare.

export type ReportKind = 'report' | 'request'
export type ReportReason = 'wrong' | 'unclear' | 'other'
export type ReportStatus = 'open' | 'in_progress' | 'resolved' | 'dismissed'

export const REPORT_REASONS: readonly ReportReason[] = ['wrong', 'unclear', 'other']
export const NOTE_MAX = 500

export interface MyReport {
  id: number
  kind: ReportKind
  status: ReportStatus
  createdAt: string
}

export type SendProblem = 'duplicate' | 'limit' | 'invalid' | 'generic'

/** Le proprie segnalazioni e richieste per una carta, dalla più recente. */
export async function loadMyReports(cardCode: string): Promise<MyReport[]> {
  const { data, error } = await getSupabase()
    .from('explanation_reports')
    .select('id, kind, status, created_at')
    .eq('card_code', cardCode)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data.map((row) => ({
    id: row.id,
    kind: row.kind as ReportKind,
    status: row.status as ReportStatus,
    createdAt: row.created_at,
  }))
}

export function sendProblemOf(error: { code?: string; message?: string }): SendProblem {
  if (error.code === '23505') return 'duplicate'
  if (error.code === '23514') {
    return error.message?.includes('troppe_segnalazioni') ? 'limit' : 'invalid'
  }
  return 'generic'
}

export async function sendReport(input: {
  cardCode: string
  kind: ReportKind
  reason: ReportReason | null
  note: string
}): Promise<SendProblem | null> {
  const note = input.note.trim()
  const { error } = await getSupabase()
    .from('explanation_reports')
    .insert({
      card_code: input.cardCode,
      kind: input.kind,
      reason: input.kind === 'report' ? input.reason : null,
      note: note === '' ? null : note,
    })
  return error ? sendProblemOf(error) : null
}
