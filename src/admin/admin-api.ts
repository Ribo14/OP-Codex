import { getSupabase } from '@/lib/supabase'
import type { JobSummary } from './job-health'

// Area Admin (RIB-89): panoramica e utenti. Ogni funzione del database verifica da sé che chi
// chiama sia un Admin attivo; qui si leggono solo i risultati.

export interface Overview {
  users: number
  users_new_7d: number
  users_active_7d: number
  users_suspended: number
  decks: number
  collection_copies: number
  open_reports: number
  /** Contenuti da completare in sessione (RIB-93); assente prima della migrazione. */
  content?: MissingContent
  jobs: JobSummary[]
}

export interface MissingContent {
  missing_explanations: number
  missing_explanations_preview: number
  /** Per prefisso del Card Code ("OP19"), dal Set con più carte mancanti. */
  missing_by_set: { set: string; count: number; preview: boolean }[]
  sets_without_faq: string[]
}

export interface AdminUser {
  id: string
  username: string | null
  created_at: string
  last_sign_in_at: string | null
  mfa: boolean
  admin: boolean
  suspended: boolean
  decks: number
  copies: number
}

export interface AdminUserDetail extends AdminUser {
  email: string | null
  providers: string[]
  sessions: number
}

export async function fetchOverview(): Promise<Overview> {
  const { data, error } = await getSupabase().rpc('admin_panoramica')
  if (error) throw error
  return data as unknown as Overview
}

export async function fetchUsers(): Promise<AdminUser[]> {
  const { data, error } = await getSupabase().rpc('admin_utenti')
  if (error) throw error
  return data
}

export async function fetchUser(id: string): Promise<AdminUserDetail> {
  const { data, error } = await getSupabase().rpc('admin_utente', { p_id: id })
  if (error) throw error
  return data as unknown as AdminUserDetail
}

/** Sospende (e chiude le sessioni) o riattiva un utente. */
export async function setSuspended(id: string, suspended: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('admin_sospendi_utente', {
    p_id: id,
    p_sospeso: suspended,
  })
  if (error) throw error
}

/** Chiude tutte le sessioni di un utente; restituisce quante erano. */
export async function closeSessions(id: string): Promise<number> {
  const { data, error } = await getSupabase().rpc('admin_chiudi_sessioni', { p_id: id })
  if (error) throw error
  return data
}

/** Filtra gli utenti per Username (senza maiuscole/minuscole). */
export function filterUsers(users: AdminUser[], query: string): AdminUser[] {
  const q = query.trim().toLowerCase()
  if (q === '') return users
  return users.filter((u) => (u.username ?? '').toLowerCase().includes(q))
}

/** Data breve in italiano (es. 12/10/26). */
export function shortDate(iso: string): string {
  return new Intl.DateTimeFormat('it', { dateStyle: 'short' }).format(new Date(iso))
}
