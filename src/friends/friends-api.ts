import { getSupabase } from '@/lib/supabase'

// Chiamate al database per gli Amici (RIB-71, ADR-0015). Tutto passa dalle funzioni del
// database, che controllano blocchi e duplicati; gli altri User sono sempre il loro Username.

/** Il rapporto con un altro User, visto da chi chiama. */
export type Relation = 'amico' | 'inviata' | 'ricevuta' | 'nessuno'

export interface FoundUser {
  username: string
  relation: Relation
}

export interface FriendsState {
  friends: { username: string; since: string }[]
  received: { username: string; at: string }[]
  sent: { username: string; at: string }[]
  /** Gli utenti bloccati da chi chiama (RIB-72). */
  blocked: { username: string; since: string }[]
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

const RELATIONS: readonly Relation[] = ['amico', 'inviata', 'ricevuta', 'nessuno']
const toRelation = (value: string): Relation => RELATIONS.find((r) => r === value) ?? 'nessuno'

// Dopo ogni azione il badge delle richieste si aggiorna (usePendingRequests).
export const FRIENDS_CHANGED = 'op-codex:amici'
const changed = () => {
  window.dispatchEvent(new Event(FRIENDS_CHANGED))
}

/** Username esatto (maiuscole indifferenti); null se non c'è (o non si può trovare). */
export async function searchUser(username: string): Promise<FoundUser | null> {
  const { data, error } = await getSupabase().rpc('cerca_utente', { p_username: username })
  fail(error)
  const [row] = data
  return row ? { username: row.username, relation: toRelation(row.rapporto) } : null
}

/** Invia la richiesta; se l'altro l'aveva già chiesta si diventa subito amici. */
export async function sendRequest(username: string): Promise<Relation> {
  const { data, error } = await getSupabase().rpc('invia_richiesta_amicizia', {
    p_username: username,
  })
  fail(error)
  changed()
  return toRelation(data)
}

async function answer(
  fn: 'accetta_richiesta_amicizia' | 'rifiuta_richiesta_amicizia' | 'annulla_richiesta_amicizia',
  username: string,
) {
  const { error } = await getSupabase().rpc(fn, { p_username: username })
  fail(error)
  changed()
}

export const acceptRequest = (username: string) => answer('accetta_richiesta_amicizia', username)
export const rejectRequest = (username: string) => answer('rifiuta_richiesta_amicizia', username)
export const cancelRequest = (username: string) => answer('annulla_richiesta_amicizia', username)

// Rimuovi amico e User Block (RIB-72). Chi viene rimosso o bloccato non viene avvisato.
async function manage(fn: 'rimuovi_amico' | 'blocca_utente' | 'sblocca_utente', username: string) {
  const { error } = await getSupabase().rpc(fn, { p_username: username })
  fail(error)
  changed()
}

export const removeFriend = (username: string) => manage('rimuovi_amico', username)
export const blockUser = (username: string) => manage('blocca_utente', username)
export const unblockUser = (username: string) => manage('sblocca_utente', username)

interface StateRow {
  amici: { username: string; dal: string }[]
  ricevute: { username: string; il: string }[]
  inviate: { username: string; il: string }[]
}

export async function loadFriends(): Promise<FriendsState> {
  const supabase = getSupabase()
  const [state, blocked] = await Promise.all([
    supabase.rpc('stato_amici'),
    supabase.rpc('utenti_bloccati'),
  ])
  fail(state.error)
  fail(blocked.error)
  const row = state.data as unknown as StateRow
  return {
    friends: row.amici.map((f) => ({ username: f.username, since: f.dal })),
    received: row.ricevute.map((r) => ({ username: r.username, at: r.il })),
    sent: row.inviate.map((r) => ({ username: r.username, at: r.il })),
    blocked: blocked.data.map((b) => ({ username: b.username, since: b.dal })),
  }
}

/** Quante Friend Request ricevute aspettano una risposta (per il badge). */
export async function countReceived(userId: string): Promise<number> {
  const { count, error } = await getSupabase()
    .from('friend_requests')
    .select('from_user', { count: 'exact', head: true })
    .eq('to_user', userId)
  fail(error)
  return count ?? 0
}

/** Il proprio link di invito (lo crea la prima volta). */
export async function inviteToken(): Promise<string> {
  const { data, error } = await getSupabase().rpc('link_invito_amici')
  fail(error)
  return data
}

/** Nuovo link di invito: il vecchio smette di funzionare. */
export async function regenerateInvite(): Promise<string> {
  const { data, error } = await getSupabase().rpc('rigenera_link_invito_amici')
  fail(error)
  return data
}

/** Chi ha mandato il link di invito; null se il link non vale (o non vale per chi lo apre). */
export async function inviter(token: string): Promise<FoundUser | null> {
  const { data, error } = await getSupabase().rpc('utente_da_invito', { p_token: token })
  fail(error)
  const [row] = data
  return row ? { username: row.username, relation: toRelation(row.rapporto) } : null
}
