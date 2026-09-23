import { createClient } from '@supabase/supabase-js'
import type { ImageStore } from './image-sync.ts'

export const CARD_IMAGES_BUCKET = 'card-images'

// Le immagini di una Printing non cambiano: il browser e la CDN possono tenerle a lungo.
const CACHE_SECONDS = 60 * 60 * 24 * 365

/**
 * Store su Supabase Storage. Richiede la chiave segreta (bypassa la RLS):
 * si usa solo negli script del Catalog Sync, mai nel frontend.
 */
export function supabaseImageStore(url: string, secretKey: string): ImageStore {
  const bucket = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }).storage.from(CARD_IMAGES_BUCKET)

  return {
    async upload(path, data) {
      const { error } = await bucket.upload(path, data, {
        contentType: 'image/webp',
        cacheControl: String(CACHE_SECONDS),
        upsert: true,
      })
      if (error) throw new Error(`Upload di ${path} fallito: ${error.message}`)
    },
  }
}
