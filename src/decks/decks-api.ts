import { isOffline, readPersonal, withOfflineCopy, writePersonal } from '@/lib/personal-cache'
import { getSupabase } from '@/lib/supabase'
import type { DeckCard, DeckSummary } from './deck'
import type { DeckFormat } from './deck-rules'

// Chiamate al database per i Deck (RIB-21). Le policy RLS garantiscono che ognuno tocchi solo i
// propri Deck: qui non serve passare l'utente.

export interface DeckDetail {
  deck: DeckSummary
  cards: DeckCard[]
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

const DECK_COLUMNS =
  'id, name, leader_code, leader_print_id, format, share_token, updated_at, deck_cards(card_code, quantity, print_id)'

interface DeckRow {
  id: string
  name: string
  leader_code: string
  leader_print_id: string | null
  format: string
  share_token: string | null
  updated_at: string
  deck_cards: { card_code: string; quantity: number; print_id: string | null }[]
}

function toDetail(row: DeckRow): DeckDetail {
  const cards = row.deck_cards.map((c) => ({
    cardCode: c.card_code,
    quantity: c.quantity,
    printId: c.print_id,
  }))
  return {
    deck: {
      id: row.id,
      name: row.name,
      leaderCode: row.leader_code,
      leaderPrintId: row.leader_print_id,
      updatedAt: row.updated_at,
      cardCount: cards.reduce((sum, c) => sum + c.quantity, 0),
      format: row.format === 'extra' ? 'extra' : 'standard',
      shareToken: row.share_token,
    },
    cards,
  }
}

// ---- Share Link (RIB-26) ----

/** Crea lo Share Link (o restituisce quello attivo) e ne restituisce il token. */
export async function createShareLink(deckId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('crea_link_mazzo', { p_deck_id: deckId })
  fail(error)
  return data
}

/** Revoca lo Share Link: il vecchio link smette di funzionare. */
export async function revokeShareLink(deckId: string): Promise<void> {
  const { error } = await getSupabase().rpc('revoca_link_mazzo', { p_deck_id: deckId })
  fail(error)
}

export interface SharedDeck {
  name: string
  leaderCode: string
  leaderPrintId: string | null
  format: 'standard' | 'extra'
  updatedAt: string
  /** Username dell'autore (null se non l'ha ancora scelto). */
  username: string | null
  cards: DeckCard[]
}

interface SharedRow {
  name: string
  leader_code: string
  leader_print_id: string | null
  format: string
  updated_at: string
  username: string | null
  cards: { card_code: string; quantity: number; print_id: string | null }[]
}

/** Il Deck di uno Share Link, anche senza account; null se il link non esiste o è stato revocato. */
export async function loadSharedDeck(token: string): Promise<SharedDeck | null> {
  const { data, error } = await getSupabase().rpc('mazzo_condiviso', { p_token: token })
  fail(error)
  if (!data) return null
  const row = data as unknown as SharedRow
  return {
    name: row.name,
    leaderCode: row.leader_code,
    leaderPrintId: row.leader_print_id,
    format: row.format === 'extra' ? 'extra' : 'standard',
    updatedAt: row.updated_at,
    username: row.username,
    cards: row.cards.map((c) => ({
      cardCode: c.card_code,
      quantity: c.quantity,
      printId: c.print_id,
    })),
  }
}

/** I miei Deck, con le carte (servono all'indicatore valido/con avvisi dell'elenco). */
/** Utente della sessione salvata (disponibile anche offline). */
async function currentUserId(): Promise<string | null> {
  const { data } = await getSupabase().auth.getSession()
  return data.session?.user.id ?? null
}

async function fetchDecks(): Promise<DeckDetail[]> {
  const { data, error } = await getSupabase()
    .from('decks')
    .select(DECK_COLUMNS)
    .order('updated_at', { ascending: false })
  fail(error)
  return data.map(toDetail)
}

/**
 * I miei Deck, con le carte (servono all'indicatore valido/con avvisi dell'elenco). Online se ne
 * salva una copia; offline si usa quella (RIB-27).
 */
export async function listDecks(): Promise<DeckDetail[]> {
  const userId = await currentUserId()
  return userId ? withOfflineCopy('decks', userId, fetchDecks) : fetchDecks()
}

/**
 * Il Deck con le sue carte; null se non esiste o non è dell'utente. Online aggiorna anche la
 * copia locale dell'elenco; offline lo prende da lì (RIB-27).
 */
export async function loadDeck(deckId: string): Promise<DeckDetail | null> {
  const userId = await currentUserId()
  const fromCopy = async () => {
    const saved = userId ? await readPersonal<DeckDetail[]>('decks', userId) : null
    return saved?.find((d) => d.deck.id === deckId) ?? null
  }
  if (isOffline()) {
    const copy = await fromCopy()
    if (copy) return copy
  }
  try {
    const { data, error } = await getSupabase()
      .from('decks')
      .select(DECK_COLUMNS)
      .eq('id', deckId)
      .maybeSingle()
    fail(error)
    const detail = data ? toDetail(data) : null
    if (userId) {
      const saved = (await readPersonal<DeckDetail[]>('decks', userId)) ?? []
      const others = saved.filter((d) => d.deck.id !== deckId)
      await writePersonal('decks', userId, detail ? [detail, ...others] : others)
    }
    return detail
  } catch (error) {
    const copy = await fromCopy()
    if (copy) return copy
    throw error
  }
}

export async function setDeckFormat(deckId: string, format: DeckFormat): Promise<void> {
  const { error } = await getSupabase().from('decks').update({ format }).eq('id', deckId)
  fail(error)
}

export async function createDeck(name: string, leaderCode: string): Promise<string> {
  const { data, error } = await getSupabase()
    .from('decks')
    .insert({ name, leader_code: leaderCode })
    .select('id')
    .single()
  fail(error)
  return data.id
}

/**
 * Crea un Deck già pieno (import di una lista, RIB-24): il Deck e poi tutte le carte in una sola
 * richiesta. Se le carte non si salvano, il Deck appena creato si elimina: niente mezzi import.
 */
export async function createDeckWithCards(
  name: string,
  leaderCode: string,
  cards: readonly (Pick<DeckCard, 'cardCode' | 'quantity'> & { printId?: string | null })[],
): Promise<string> {
  const deckId = await createDeck(name, leaderCode)
  if (cards.length === 0) return deckId
  const { error } = await getSupabase()
    .from('deck_cards')
    .insert(
      cards.map((c) => ({
        deck_id: deckId,
        card_code: c.cardCode,
        quantity: Math.min(c.quantity, 50),
        print_id: c.printId ?? null,
      })),
    )
  if (error) {
    await deleteDeck(deckId).catch(() => undefined)
    throw new Error(error.message)
  }
  return deckId
}

export async function renameDeck(deckId: string, name: string): Promise<void> {
  const { error } = await getSupabase().from('decks').update({ name }).eq('id', deckId)
  fail(error)
}

export async function setLeader(
  deckId: string,
  leaderCode: string,
  leaderPrintId: string | null,
): Promise<void> {
  const { error } = await getSupabase()
    .from('decks')
    .update({ leader_code: leaderCode, leader_print_id: leaderPrintId })
    .eq('id', deckId)
  fail(error)
}

export async function deleteDeck(deckId: string): Promise<void> {
  const { error } = await getSupabase().from('decks').delete().eq('id', deckId)
  fail(error)
}

export async function duplicateDeck(deckId: string): Promise<string> {
  const { data, error } = await getSupabase().rpc('duplica_mazzo', { p_deck_id: deckId })
  fail(error)
  return data
}

/** +/− atomico sul server; restituisce le copie risultanti. */
export async function changeDeckCard(deckId: string, cardCode: string, delta: number) {
  const { data, error } = await getSupabase().rpc('cambia_carte_mazzo', {
    p_deck_id: deckId,
    p_card_code: cardCode,
    p_delta: delta,
  })
  fail(error)
  return data
}

export async function setDeckCardPrint(
  deckId: string,
  cardCode: string,
  printId: string | null,
): Promise<void> {
  const { error } = await getSupabase()
    .from('deck_cards')
    .update({ print_id: printId })
    .eq('deck_id', deckId)
    .eq('card_code', cardCode)
  fail(error)
}
