import { useTranslation } from 'react-i18next'

// Prezzi (RIB-32): formato in euro e link a Cardmarket, condivisi da dettaglio, Collection e Deck.

/** Ricerca per Card Code su Cardmarket: mostra tutte le versioni della carta. */
export function cardmarketUrl(cardCode: string): string {
  return `https://www.cardmarket.com/it/OnePiece/Products/Search?searchString=${encodeURIComponent(cardCode)}`
}

/** Formatta un importo in euro nella lingua dell'app (es. "45,20 €"). */
export function useEuro(): (value: number) => string {
  const { i18n } = useTranslation()
  const format = new Intl.NumberFormat(i18n.language, { style: 'currency', currency: 'EUR' })
  return (value) => format.format(value)
}
