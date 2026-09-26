import type { User } from '@supabase/supabase-js'
import { getSupabase } from '@/lib/supabase'
import type { ExportCollectionEntry, ExportData, ExportDeck, ExportReport } from './data-export'

// Lettura dei dati per "Esporta i miei dati" (RIB-28). Le policy RLS fanno già vedere solo i
// propri dati; il filtro sull'utente resta comunque esplicito, così quando arriveranno i Deck
// visibili agli amici l'export non li includerà per sbaglio.

// Il server restituisce al massimo 1000 righe per richiesta.
const PAGE_SIZE = 1000

async function allPages<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}

export async function loadExportData(
  user: User,
  shareUrl: (token: string) => string,
): Promise<ExportData> {
  const supabase = getSupabase()
  const [profile, collection, decks, reports] = await Promise.all([
    supabase.from('profiles').select('username, created_at, updated_at').eq('id', user.id).single(),
    allPages((from, to) =>
      supabase
        .from('collection_entries')
        .select('print_id, language, quantity, created_at, updated_at')
        .eq('user_id', user.id)
        .order('print_id')
        .order('language')
        .range(from, to),
    ),
    allPages((from, to) =>
      supabase
        .from('decks')
        .select(
          'id, name, leader_code, leader_print_id, format, visibility, share_token, created_at, updated_at, deck_cards(card_code, quantity, print_id)',
        )
        .eq('user_id', user.id)
        .order('created_at')
        .order('id')
        .range(from, to),
    ),
    // Segnalazioni e richieste di spiegazione (RIB-54): l'Admin le legge tutte, quindi il filtro
    // sull'utente qui serve davvero.
    allPages((from, to) =>
      supabase
        .from('explanation_reports')
        .select('card_code, kind, reason, note, status, created_at, updated_at')
        .eq('user_id', user.id)
        .order('created_at')
        .order('id')
        .range(from, to),
    ),
  ])
  if (profile.error) throw new Error(profile.error.message)

  return {
    exportedAt: new Date().toISOString(),
    profile: {
      username: profile.data.username,
      email: user.email ?? null,
      createdAt: profile.data.created_at,
      updatedAt: profile.data.updated_at,
    },
    collection: collection.map((row): ExportCollectionEntry => ({
      printId: row.print_id,
      language: row.language,
      quantity: row.quantity,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
    decks: decks.map((row): ExportDeck => ({
      id: row.id,
      name: row.name,
      leaderCode: row.leader_code,
      leaderPrintId: row.leader_print_id,
      format: row.format,
      visibility: row.visibility,
      shareLink: row.share_token ? shareUrl(row.share_token) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cards: row.deck_cards
        .map((c) => ({ cardCode: c.card_code, quantity: c.quantity, printId: c.print_id }))
        .sort((a, b) => a.cardCode.localeCompare(b.cardCode, 'en', { numeric: true })),
    })),
    reports: reports.map((row): ExportReport => ({
      cardCode: row.card_code,
      kind: row.kind,
      reason: row.reason,
      note: row.note,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  }
}

/**
 * Consegna il file all'utente. Nella PWA installata di iOS un link di download apre un'anteprima
 * senza via d'uscita, quindi lì si usa la condivisione del sistema ("Salva su File"). Altrove il
 * classico download: Chrome per Android, per esempio, non condivide file .zip (NotAllowedError).
 * Deve partire da un tocco dell'utente.
 */
export async function deliverFile(file: File): Promise<void> {
  // navigator.standalone esiste solo su iOS/iPadOS ed è true solo nella PWA installata.
  const iosApp = (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (iosApp && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] })
      return
    } catch (error) {
      // Chiusa senza scegliere: nessun problema.
      if (error instanceof DOMException && error.name === 'AbortError') return
      // Condivisione rifiutata: si prova col download.
    }
  }
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 60_000)
}
