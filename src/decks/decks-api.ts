import { getSupabase } from '@/lib/supabase'
import type { DeckCard, DeckSummary } from './deck'

// Chiamate al database per i Deck (RIB-21). Le policy RLS garantiscono che ognuno tocchi solo i
// propri Deck: qui non serve passare l'utente.

export interface DeckDetail {
  deck: DeckSummary
  cards: DeckCard[]
}

function fail(error: { message: string } | null): asserts error is null {
  if (error) throw new Error(error.message)
}

export async function listDecks(): Promise<DeckSummary[]> {
  const { data, error } = await getSupabase()
    .from('decks')
    .select('id, name, leader_code, leader_print_id, updated_at, deck_cards(quantity)')
    .order('updated_at', { ascending: false })
  fail(error)
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    leaderCode: row.leader_code,
    leaderPrintId: row.leader_print_id,
    updatedAt: row.updated_at,
    cardCount: row.deck_cards.reduce((sum, c) => sum + c.quantity, 0),
  }))
}

/** Il Deck con le sue carte; null se non esiste o non è dell'utente. */
export async function loadDeck(deckId: string): Promise<DeckDetail | null> {
  const { data, error } = await getSupabase()
    .from('decks')
    .select(
      'id, name, leader_code, leader_print_id, updated_at, deck_cards(card_code, quantity, print_id)',
    )
    .eq('id', deckId)
    .maybeSingle()
  fail(error)
  if (!data) return null
  const cards = data.deck_cards.map((c) => ({
    cardCode: c.card_code,
    quantity: c.quantity,
    printId: c.print_id,
  }))
  return {
    deck: {
      id: data.id,
      name: data.name,
      leaderCode: data.leader_code,
      leaderPrintId: data.leader_print_id,
      updatedAt: data.updated_at,
      cardCount: cards.reduce((sum, c) => sum + c.quantity, 0),
    },
    cards,
  }
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
