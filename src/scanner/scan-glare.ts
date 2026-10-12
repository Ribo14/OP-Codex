// Riflessi delle bustine (RIB-86). Codice puro su immagini in scala di grigi.
//
// - glareFraction: quanta parte della zona del codice è "bruciata" dal riflesso.
// - FrameStack + fuseMin: le zone del codice di più fotogrammi recenti, già allineate (stessa
//   carta trovata, stessa dimensione), combinate tenendo per ogni pixel il valore più scuro. Il
//   testo è fermo e c'è in tutti; il riflesso si sposta appena la mano si muove, quindi in
//   almeno un fotogramma quel punto è pulito e il minimo lo cancella.

/** Sopra questa luminosità un pixel è bruciato dal riflesso. */
const BURNT = 245
/** Da questa parte di pixel bruciati in su la zona ha un riflesso che disturba la lettura. */
export const GLARE_THRESHOLD = 0.06

/** La parte di pixel bruciati (0–1). */
export function glareFraction(gray: Uint8Array | Uint8ClampedArray): number {
  if (gray.length === 0) return 0
  let burnt = 0
  for (const v of gray) if (v >= BURNT) burnt++
  return burnt / gray.length
}

/** Per ogni pixel il valore più scuro tra le immagini (tutte della stessa dimensione). */
export function fuseMin(frames: readonly (Uint8Array | Uint8ClampedArray)[]): Uint8Array {
  const [first] = frames
  if (!first) return new Uint8Array(0)
  const out = Uint8Array.from(first)
  for (const frame of frames.slice(1)) {
    if (frame.length !== out.length) continue
    for (let i = 0; i < out.length; i++) {
      const v = frame[i] ?? 255
      if (v < (out[i] ?? 255)) out[i] = v
    }
  }
  return out
}

/** Gli ultimi fotogrammi (zone già allineate), per la fusione. */
export class FrameStack {
  private frames: Uint8Array[] = []
  private readonly size: number
  private readonly capacity: number

  constructor(size: number, capacity = 4) {
    this.size = size
    this.capacity = capacity
  }

  push(gray: Uint8Array) {
    // Dimensione diversa (non dovrebbe capitare): si riparte da capo.
    if (gray.length !== this.size) return
    this.frames.push(gray)
    if (this.frames.length > this.capacity) this.frames.shift()
  }

  /** Si svuota quando la carta sparisce o cambia: i fotogrammi vecchi non sono più allineati. */
  clear() {
    this.frames = []
  }

  get length() {
    return this.frames.length
  }

  fused(): Uint8Array {
    return fuseMin(this.frames)
  }
}
