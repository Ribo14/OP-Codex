// Unico punto in cui si costruisce l'URL dell'immagine di una Printing (ADR-0005).
// Le immagini sono copie WebP su Supabase Storage, caricate dall'Image Sync:
//   thumb: 300 px, per la griglia   ·   full: 600 px, per il dettaglio
// Le anteprime (ADR-0016) stanno sotto preview/: quando la carta esce, la Printing ufficiale con
// lo stesso Print ID ha un altro URL e nessuna cache mostra l'immagine dell'anteprima.

export type CardImageVariant = 'thumb' | 'full'

const BUCKET = 'card-images'

const PRINT_ID = /^[A-Z0-9]+-\d+(?:_[pr]\d+)?$/

/** Basta il Print ID e, per le anteprime, il flag `preview`. */
export interface ImageSource {
  printId: string
  preview?: boolean
}

export function cardImageUrl(
  printing: ImageSource,
  variant: CardImageVariant = 'thumb',
  supabaseUrl: string | undefined = import.meta.env.VITE_SUPABASE_URL,
): string {
  const { printId, preview = false } = printing
  if (!PRINT_ID.test(printId)) throw new Error(`Print ID non valido: ${printId}`)
  if (!supabaseUrl) throw new Error('VITE_SUPABASE_URL mancante: impossibile costruire l’URL')
  const base = supabaseUrl.replace(/\/+$/, '')
  const folder = preview ? `preview/${variant}` : variant
  return `${base}/storage/v1/object/public/${BUCKET}/${folder}/${printId}.webp`
}
