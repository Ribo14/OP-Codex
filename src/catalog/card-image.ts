// Unico punto in cui si costruisce l'URL dell'immagine di una Printing (ADR-0005).
// Le immagini sono copie WebP su Supabase Storage, caricate dall'Image Sync:
//   thumb: 300 px, per la griglia   ·   full: 600 px, per il dettaglio

export type CardImageVariant = 'thumb' | 'full'

const BUCKET = 'card-images'

const PRINT_ID = /^[A-Z0-9]+-\d+(?:_[pr]\d+)?$/

export function cardImageUrl(
  printId: string,
  variant: CardImageVariant = 'thumb',
  supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL,
): string {
  if (!PRINT_ID.test(printId)) throw new Error(`Print ID non valido: ${printId}`)
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL mancante: impossibile costruire l’URL')
  const base = supabaseUrl.replace(/\/+$/, '')
  return `${base}/storage/v1/object/public/${BUCKET}/${variant}/${printId}.webp`
}
