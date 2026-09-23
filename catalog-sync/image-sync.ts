import sharp from 'sharp'

// Image Sync: copia le immagini delle Printing dal sito ufficiale a Supabase Storage in WebP
// (ADR-0005). Per ogni Printing scarica un solo PNG e ne ricava due versioni.

export const IMAGE_VARIANTS = {
  /** Griglia del catalogo. */
  thumb: { width: 300, quality: 75 },
  /** Dettaglio della Card: dimensione originale (600×838). */
  full: { width: 600, quality: 70 },
} as const

export type ImageVariant = keyof typeof IMAGE_VARIANTS

export function imagePath(variant: ImageVariant, printId: string): string {
  return `${variant}/${printId}.webp`
}

export async function convertCardImage(png: Uint8Array): Promise<Record<ImageVariant, Buffer>> {
  const convert = (variant: ImageVariant) => {
    const { width, quality } = IMAGE_VARIANTS[variant]
    return sharp(png)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality, effort: 5 })
      .toBuffer()
  }
  const [thumb, full] = await Promise.all([convert('thumb'), convert('full')])
  return { thumb, full }
}

/** Le Printing da scaricare e il loro stato. */
export interface ImageSyncRepository {
  pendingPrintIds(limit: number): Promise<string[]>
  countPending(): Promise<number>
  markSynced(printId: string): Promise<void>
}

/** Dove finiscono le immagini convertite. */
export interface ImageStore {
  upload(path: string, data: Buffer): Promise<void>
}

export interface ImageSyncOptions {
  repository: ImageSyncRepository
  store: ImageStore
  fetchImage: (printId: string) => Promise<Uint8Array>
  /** Massimo di immagini scaricate in questa esecuzione. */
  limit: number
  /** Pausa tra una richiesta al sito ufficiale e la successiva. */
  delayMs: number
  sleep?: (ms: number) => Promise<void>
  log?: (message: string) => void
}

export interface ImageSyncResult {
  synced: string[]
  failed: { printId: string; error: string }[]
  remaining: number
}

/**
 * Scarica, converte e carica le immagini delle Printing che non le hanno ancora.
 * Idempotente: le Printing già sincronizzate non vengono riscaricate.
 * Un errore su una Printing non ferma le altre: resta da scaricare per la prossima esecuzione.
 */
export async function syncImages(options: ImageSyncOptions): Promise<ImageSyncResult> {
  const { repository, store, fetchImage, limit, delayMs } = options
  const sleep = options.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)))
  const log = options.log ?? (() => undefined)

  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error(`Limite non valido: ${String(limit)}`)
  }
  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error(`Pausa non valida: ${String(delayMs)}`)
  }

  const printIds = await repository.pendingPrintIds(limit)
  const result: ImageSyncResult = { synced: [], failed: [], remaining: 0 }

  for (const [index, printId] of printIds.entries()) {
    if (index > 0) await sleep(delayMs)
    try {
      const variants = await convertCardImage(await fetchImage(printId))
      await store.upload(imagePath('thumb', printId), variants.thumb)
      await store.upload(imagePath('full', printId), variants.full)
      await repository.markSynced(printId)
      result.synced.push(printId)
      log(`${String(index + 1)}/${String(printIds.length)} ${printId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      result.failed.push({ printId, error: message })
      log(`${String(index + 1)}/${String(printIds.length)} ${printId} ERRORE: ${message}`)
    }
  }

  result.remaining = await repository.countPending()
  return result
}
