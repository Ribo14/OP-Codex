import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { getSupabase } from '@/lib/supabase'

// Ban List (RIB-29): carte bandite, limitate e coppie bandite, per Card Code (parallel comprese).
// La scrive l'Admin (tabella ban_list_entries); l'app la legge, la tiene sul dispositivo per
// l'offline e applica solo le voci già in vigore. Serve ai tag delle carte e ai Deck Warning.

export interface BanListEntry {
  id: number
  cardCode: string
  kind: 'banned' | 'restricted' | 'pair'
  /** Solo per le limitate. */
  maxCopies: number | null
  /** Solo per le coppie: l'altra carta. */
  pairCode: string | null
  /** Data di entrata in vigore (AAAA-MM-GG). */
  effectiveFrom: string
  source: string | null
}

/** La Ban List in vigore, come la usa il modulo Deck Rules. */
export interface BanList {
  banned: ReadonlySet<string>
  /** Card Code → copie massime. */
  restricted: ReadonlyMap<string, number>
  /** Coppie che non possono stare nello stesso Deck (Leader compreso). */
  pairs: readonly (readonly [string, string])[]
}

export const EMPTY_BAN_LIST: BanList = { banned: new Set(), restricted: new Map(), pairs: [] }

/** Data locale in formato AAAA-MM-GG (per confrontarla con effective_from). */
export function isoDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** Le voci in vigore a `today` (quelle con data futura non si applicano ancora). */
export function inForce(entries: readonly BanListEntry[], today: Date): BanListEntry[] {
  const day = isoDay(today)
  return entries.filter((e) => e.effectiveFrom <= day)
}

export function activeBanList(entries: readonly BanListEntry[], today: Date): BanList {
  const active = inForce(entries, today)
  return {
    banned: new Set(active.filter((e) => e.kind === 'banned').map((e) => e.cardCode)),
    restricted: new Map(
      active.flatMap((e) =>
        e.kind === 'restricted' ? [[e.cardCode, e.maxCopies ?? 0] as const] : [],
      ),
    ),
    pairs: active.flatMap((e) =>
      e.kind === 'pair' && e.pairCode ? [[e.cardCode, e.pairCode] as const] : [],
    ),
  }
}

/** Cosa dice la Ban List di una carta: per il tag rosso nel catalogo e nel dettaglio. */
export interface BanStatus {
  banned: boolean
  /** Copie consentite se limitata, altrimenti null. */
  restricted: number | null
  /** Le carte con cui non può stare nello stesso Deck. */
  pairedWith: string[]
  /** Voce futura: bandita (o limitata) da questa data. */
  upcoming: { kind: BanListEntry['kind']; from: string } | null
}

export function banStatus(
  cardCode: string,
  entries: readonly BanListEntry[],
  today: Date,
): BanStatus | null {
  const day = isoDay(today)
  const mine = entries.filter((e) => e.cardCode === cardCode || e.pairCode === cardCode)
  if (mine.length === 0) return null
  const active = mine.filter((e) => e.effectiveFrom <= day)
  const future = mine
    .filter((e) => e.effectiveFrom > day)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom))[0]
  const status: BanStatus = {
    banned: active.some((e) => e.kind === 'banned'),
    restricted: active.find((e) => e.kind === 'restricted')?.maxCopies ?? null,
    pairedWith: active.flatMap((e) =>
      e.kind === 'pair' ? [e.cardCode === cardCode ? (e.pairCode ?? '') : e.cardCode] : [],
    ),
    upcoming: future ? { kind: future.kind, from: future.effectiveFrom } : null,
  }
  const any = status.banned || status.restricted !== null || status.pairedWith.length > 0
  return any || status.upcoming ? status : null
}

export type BanKind = BanListEntry['kind']

/**
 * Per la griglia del catalogo: il tag di ogni carta coinvolta in una voce in vigore (bandita prima
 * di limitata, limitata prima di coppia). Le due carte di una coppia hanno entrambe il tag.
 */
export function banKinds(entries: readonly BanListEntry[], today: Date): Map<string, BanKind> {
  const rank: Record<BanKind, number> = { banned: 0, restricted: 1, pair: 2 }
  const kinds = new Map<string, BanKind>()
  const mark = (code: string, kind: BanKind) => {
    const current = kinds.get(code)
    if (!current || rank[kind] < rank[current]) kinds.set(code, kind)
  }
  for (const e of inForce(entries, today)) {
    mark(e.cardCode, e.kind)
    if (e.pairCode) mark(e.pairCode, e.kind)
  }
  return kinds
}

// ---- Stato condiviso: dal dispositivo subito, poi dal server ----

const CACHE_KEY = 'op-codex-ban-list'

function readCache(): BanListEntry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as BanListEntry[]) : []
  } catch {
    return []
  }
}

function writeCache(entries: readonly BanListEntry[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(entries))
  } catch {
    /* senza spazio o storage bloccato: si rilegge dal server la prossima volta */
  }
}

let entries: BanListEntry[] | null = null
let loading = false
const listeners = new Set<() => void>()

function notify(next: BanListEntry[]) {
  entries = next
  for (const listener of listeners) listener()
}

/** Scarica la Ban List dal server (una volta per apertura dell'app). */
export async function refreshBanList(): Promise<void> {
  if (loading) return
  loading = true
  try {
    const { data, error } = await getSupabase()
      .from('ban_list_entries')
      .select('id, card_code, kind, max_copies, pair_code, effective_from, source')
      .order('id')
    if (error) return
    const next = data.map((row): BanListEntry => ({
      id: row.id,
      cardCode: row.card_code,
      kind: row.kind === 'restricted' || row.kind === 'pair' ? row.kind : 'banned',
      maxCopies: row.max_copies,
      pairCode: row.pair_code,
      effectiveFrom: row.effective_from,
      source: row.source,
    }))
    writeCache(next)
    notify(next)
  } catch {
    /* offline o Supabase non configurato: resta la copia sul dispositivo */
  } finally {
    loading = false
  }
}

let fetched = false

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function snapshot(): BanListEntry[] {
  entries ??= readCache()
  return entries
}

/** Le voci della Ban List (anche future), con la copia sul dispositivo per l'offline. */
export function useBanListEntries(): BanListEntry[] {
  const state = useSyncExternalStore(subscribe, snapshot)
  useEffect(() => {
    if (fetched) return
    fetched = true
    void refreshBanList()
  }, [])
  return state
}

/** Il tag di ogni carta per la griglia del catalogo (solo Ban List: i Block sarebbero troppi). */
export function useBanKinds(): Map<string, BanKind> {
  const all = useBanListEntries()
  return useMemo(() => banKinds(all, new Date()), [all])
}

/** La Ban List in vigore oggi, per i Deck Warning. */
export function useBanList(): BanList {
  const all = useBanListEntries()
  const day = isoDay(new Date())
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `day` cambia la Ban List a mezzanotte
  return useMemo(() => activeBanList(all, new Date()), [all, day])
}
