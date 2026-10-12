import { cardImageUrl } from '@/catalog/card-image'
import { buildPdf, type JpegImage } from './pdf'
import { layoutSheets, type PrintItem } from './print-sheet'

// Stampa delle carte (RIB-80), la parte nel browser: le immagini grandi (600 px, circa 240 dpi
// a 63 mm) diventano JPEG, eventualmente in bianco e nero, e finiscono nel PDF.

export const PRINT_COLORS = ['color', 'gray'] as const
export type PrintColor = (typeof PRINT_COLORS)[number]

/** Qualità JPEG: alta, la carta stampata deve restare leggibile. */
const JPEG_QUALITY = 0.92
/** Immagini preparate in parallelo. */
const CONCURRENCY = 4

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    // Richiesta CORS: serve per leggere i pixel nel canvas (e la usa anche la cache offline).
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      resolve(image)
    }
    image.onerror = () => {
      reject(new Error(`Immagine non caricata: ${src}`))
    }
    image.src = src
  })
}

/** Luminanza percepita (ITU-R BT.601): il grigio che corrisponde a ogni colore. */
function toGray(data: Uint8ClampedArray) {
  for (let i = 0; i < data.length; i += 4) {
    const y = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0)
    data[i] = data[i + 1] = data[i + 2] = y
  }
}

async function printingJpeg(printId: string, color: PrintColor): Promise<JpegImage> {
  const image = await loadImage(cardImageUrl(printId, 'full'))
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas non disponibile')
  // Fondo bianco: il JPEG non ha trasparenza (gli angoli arrotondati restano bianchi).
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(image, 0, 0)
  if (color === 'gray') {
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    toGray(pixels.data)
    context.putImageData(pixels, 0, 0)
  }
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  })
  if (!blob) throw new Error('Conversione in JPEG non riuscita')
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    width: canvas.width,
    height: canvas.height,
  }
}

/**
 * Il PDF da stampare: fogli A4 con 9 carte. `onProgress` riceve quante immagini sono pronte
 * sul totale (ogni Printing si prepara una volta sola, anche con più copie).
 */
export async function createPrintPdf(
  items: readonly PrintItem[],
  color: PrintColor,
  onProgress: (done: number, total: number) => void = () => undefined,
): Promise<Blob> {
  const sheets = layoutSheets(items)
  const printIds = [...new Set(sheets.flat().map((card) => card.printId))]
  const images = new Map<string, JpegImage>()
  let next = 0
  onProgress(0, printIds.length)
  const worker = async () => {
    while (next < printIds.length) {
      const printId = printIds[next++]
      if (printId === undefined) return
      images.set(printId, await printingJpeg(printId, color))
      onProgress(images.size, printIds.length)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  const pdf = buildPdf(sheets, images)
  return new Blob([pdf.buffer as ArrayBuffer], { type: 'application/pdf' })
}

/** Il nome del file: "op-codex-<nome>.pdf", senza caratteri strani. */
export function pdfFileName(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `op-codex-${slug || 'carte'}.pdf`
}

/** Si può passare il PDF al foglio di condivisione (iPhone, Android): "Salva in File", stampa… */
export function canSharePdf(file: File): boolean {
  return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
}

/** Condivide il PDF; false se l'utente chiude il foglio di condivisione. */
export async function sharePdf(file: File): Promise<boolean> {
  try {
    await navigator.share({ files: [file] })
    return true
  } catch {
    return false
  }
}

/** Scarica il PDF (computer, o telefono senza condivisione di file). */
export function downloadPdf(file: File) {
  const url = URL.createObjectURL(file)
  const link = document.createElement('a')
  link.href = url
  link.download = file.name
  document.body.append(link)
  link.click()
  link.remove()
  // Il browser ha già preso il file: il link si libera dopo un po'.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 60_000)
}
