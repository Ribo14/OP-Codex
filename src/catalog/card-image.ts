// Unico punto in cui si costruisce l'URL dell'immagine di una Printing (ADR-0005).
//
// Il sito ufficiale risponde con `Cross-Origin-Resource-Policy: same-site`, quindi il browser
// non mostra le sue immagini su un altro dominio. Le chiediamo al nostro stesso dominio, sotto
// /card-images/, e ogni ambiente le inoltra al sito ufficiale:
//   - sviluppo e preview: proxy di Vite (vite.config.ts)
//   - produzione: da decidere (vedi RIB-9)

const CARD_IMAGE_BASE = '/card-images'

const PRINT_ID = /^[A-Z0-9]+-\d+(?:_[pr]\d+)?$/

export function cardImageUrl(printId: string): string {
  if (!PRINT_ID.test(printId)) throw new Error(`Print ID non valido: ${printId}`)
  return `${CARD_IMAGE_BASE}/${printId}.png`
}
