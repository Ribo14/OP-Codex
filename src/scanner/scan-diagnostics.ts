import { openDB, type IDBPDatabase } from 'idb'
import { useCallback, useEffect, useState } from 'react'
import { createZip } from '@/lib/zip'

// Modalità diagnostica dello Scanner (RIB-87): con l'interruttore acceso (area Admin, solo su
// questo dispositivo) lo Scanner tiene i ritagli della zona del codice letti male, per migliorare
// la lettura con dati veri. Restano sul dispositivo finché non si esportano a mano in uno zip.

const ENABLED_KEY = 'op-codex-scanner-diagnostics'
const DB_NAME = 'op-codex-scanner-diagnostics'
const STORE = 'crops'
/** Ritagli tenuti al massimo: i più vecchi escono. */
export const MAX_CROPS = 40

export interface DiagnosticCrop {
  /** PNG della zona del codice, come la vede l'OCR. */
  image: Blob
  /** Il testo letto dall'ultimo tentativo. */
  text: string
  /** Parte della zona bruciata da un riflesso (0–1). */
  glare: number
  /** La carta era stata trovata nel fotogramma (ritaglio dinamico) o si usava il riquadro fisso. */
  detected: boolean
  at: number
}

export function diagnosticsEnabled(): boolean {
  try {
    return localStorage.getItem(ENABLED_KEY) === '1'
  } catch {
    return false
  }
}

export function setDiagnosticsEnabled(enabled: boolean) {
  try {
    if (enabled) localStorage.setItem(ENABLED_KEY, '1')
    else localStorage.removeItem(ENABLED_KEY)
  } catch {
    /* senza localStorage la diagnostica resta spenta */
  }
}

let db: Promise<IDBPDatabase> | null = null
function open() {
  db ??= openDB(DB_NAME, 1, {
    upgrade(database) {
      database.createObjectStore(STORE, { autoIncrement: true })
    },
  })
  return db
}

export async function saveCrop(crop: DiagnosticCrop): Promise<void> {
  try {
    const database = await open()
    await database.add(STORE, crop)
    const keys = await database.getAllKeys(STORE)
    for (const key of keys.slice(0, Math.max(0, keys.length - MAX_CROPS))) {
      await database.delete(STORE, key)
    }
  } catch {
    /* senza IndexedDB niente diagnostica */
  }
}

export async function listCrops(): Promise<DiagnosticCrop[]> {
  try {
    return (await (await open()).getAll(STORE)) as DiagnosticCrop[]
  } catch {
    return []
  }
}

export async function clearCrops(): Promise<void> {
  try {
    await (await open()).clear(STORE)
  } catch {
    /* niente da cancellare */
  }
}

/** Lo zip da passare allo sviluppo: le immagini e un indice con testo letto e riflesso. */
export async function cropsZip(crops: readonly DiagnosticCrop[]): Promise<Blob> {
  const entries = await Promise.all(
    crops.map(async (crop, i) => ({
      name: `ritaglio-${String(i + 1).padStart(2, '0')}.png`,
      content: new Uint8Array(await crop.image.arrayBuffer()),
    })),
  )
  const index = crops.map((crop, i) => ({
    file: entries[i]?.name,
    text: crop.text,
    glare: Math.round(crop.glare * 100) / 100,
    detected: crop.detected,
    at: new Date(crop.at).toISOString(),
  }))
  const zip = createZip([
    ...entries,
    { name: 'indice.json', content: JSON.stringify(index, null, 2) },
  ])
  return new Blob([zip], { type: 'application/zip' })
}

/**
 * Stato della diagnostica per l'interfaccia: accesa o spenta, quanti ritagli, aggiorna.
 * `refreshKey` cambia quando lo Scanner salva un ritaglio: il conteggio si rilegge.
 */
export function useDiagnostics(refreshKey = 0) {
  const [enabled, setEnabled] = useState(diagnosticsEnabled)
  const [count, setCount] = useState(0)
  const refresh = useCallback(async () => {
    setCount((await listCrops()).length)
  }, [])
  useEffect(() => {
    if (!enabled) return
    let active = true
    void listCrops().then((crops) => {
      if (active) setCount(crops.length)
    })
    return () => {
      active = false
    }
  }, [enabled, refreshKey])
  const toggle = (next: boolean) => {
    setDiagnosticsEnabled(next)
    setEnabled(next)
  }
  return { enabled, count, refresh, toggle }
}
