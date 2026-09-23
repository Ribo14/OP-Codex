export interface SetPrinting {
  printId: string
  cardCode: string
  name: string
}

/**
 * Una Printing da mostrare per ogni Card Code: la base se c'è, altrimenti la prima
 * in ordine di Print ID. Il risultato è ordinato per Card Code.
 */
export function pickDisplayPrintings(printings: readonly SetPrinting[]): SetPrinting[] {
  const byCard = new Map<string, SetPrinting>()
  for (const printing of [...printings].sort((a, b) => a.printId.localeCompare(b.printId))) {
    const current = byCard.get(printing.cardCode)
    const isBase = printing.printId === printing.cardCode
    if (!current || isBase) byCard.set(printing.cardCode, printing)
  }
  return [...byCard.values()].sort((a, b) => a.cardCode.localeCompare(b.cardCode))
}
