import { useCallback, useMemo } from 'react'
import { isStandardLegal, minimumStandardBlock } from '@/decks/deck-rules'
import { banStatus, isoDay, useBanListEntries, type BanKind, type BanListEntry } from './ban-list'
import type { CatalogCard, CatalogPrinting } from './catalog-data'

// Simbolini di stato (RIB-97): nelle liste di carte (catalogo, aggiunta al mazzo, scelta del
// Leader) dicono a colpo d'occhio se una carta ha qualcosa di particolare. Stessi casi dei tag
// del dettaglio (LegalityTags), nell'ordine in cui contano.

export type CardFlag =
  | { kind: 'banned' }
  | { kind: 'restricted'; copies: number }
  | { kind: 'pair'; with: string[] }
  | { kind: 'upcoming'; ban: BanKind; from: string }
  | { kind: 'preview' }
  | { kind: 'notStandard'; block: string; min: number }

export interface CardFlagOptions {
  /** Segnala le carte fuori dal formato Standard (Block Number System). */
  standard: boolean
}

export function cardFlags(
  card: CatalogCard,
  printing: CatalogPrinting | undefined,
  entries: readonly BanListEntry[],
  today: Date,
  options: CardFlagOptions,
): CardFlag[] {
  const flags: CardFlag[] = []
  const status = banStatus(card.cardCode, entries, today)
  if (status?.banned) flags.push({ kind: 'banned' })
  if (status && status.restricted !== null) {
    flags.push({ kind: 'restricted', copies: status.restricted })
  }
  if (status && status.pairedWith.length > 0) flags.push({ kind: 'pair', with: status.pairedWith })
  if (status?.upcoming) {
    flags.push({ kind: 'upcoming', ban: status.upcoming.kind, from: status.upcoming.from })
  }
  if (printing?.preview ?? card.preview) flags.push({ kind: 'preview' })
  if (options.standard && !isStandardLegal(card.block, today)) {
    flags.push({ kind: 'notStandard', block: card.block ?? '', min: minimumStandardBlock(today) })
  }
  return flags
}

/** I simbolini di una carta, con la Ban List sul dispositivo e la data di oggi. */
export function useCardFlags(
  options: CardFlagOptions,
): (card: CatalogCard, printing?: CatalogPrinting) => CardFlag[] {
  const entries = useBanListEntries()
  const day = isoDay(new Date())
  const { standard } = options
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `day` cambia i simbolini a mezzanotte
  const today = useMemo(() => new Date(), [day])
  return useCallback(
    (card, printing) => cardFlags(card, printing, entries, today, { standard }),
    [entries, today, standard],
  )
}
