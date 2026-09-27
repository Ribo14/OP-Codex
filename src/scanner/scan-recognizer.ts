// Scan Recognizer (fase 4, slice 4.1): dal testo grezzo dell'OCR, letto sulla zona in basso a
// destra della carta, ai Card Code. Codice puro: l'OCR (Tesseract.js) sta altrove.
//
// Forme dei Card Code nel catalogo: OP01-001, ST01-001, EB01-001, PRB01-001 e P-001. L'OCR
// sbaglia soprattutto lettere e cifre simili (O↔0, I/l↔1, S↔5, B↔8, Z↔2, G↔6): nel prefisso
// si leggono come lettere, nei numeri come cifre.

const PREFIXES = new Set(['OP', 'ST', 'EB'])

// Nel prefisso anche lettere tonde lette male: CP13 → OP13, QP05 → OP05.
const AS_LETTER: Record<string, string> = {
  '0': 'O',
  C: 'O',
  Q: 'O',
  D: 'O',
  '5': 'S',
  '8': 'B',
  '7': 'T',
  '6': 'G',
  '2': 'Z',
}
const AS_DIGIT: Record<string, string> = {
  O: '0',
  D: '0',
  Q: '0',
  U: '0',
  I: '1',
  L: '1',
  Z: '2',
  A: '4',
  S: '5',
  G: '6',
  T: '7',
  B: '8',
}

// Il testo è già ridotto a A-Z e 0-9: un carattere alla volta con replace va bene.
function letters(text: string): string {
  return text.replace(/[0-9CQD]/g, (c) => AS_LETTER[c] ?? c)
}

function digits(text: string): string | null {
  const result = text.replace(/[A-Z]/g, (c) => AS_DIGIT[c] ?? c)
  return /^\d+$/.test(result) ? result : null
}

/** La parte prima del trattino: "OP01", "PRB01" o "P", già corretta; altrimenti null. */
function codePrefix(left: string): string | null {
  if (left.length === 5) {
    const number = digits(left.slice(3))
    return letters(left.slice(0, 3)) === 'PRB' && number ? `PRB${number}` : null
  }
  if (left.length === 4) {
    const prefix = letters(left.slice(0, 2))
    const number = digits(left.slice(2))
    return PREFIXES.has(prefix) && number ? `${prefix}${number}` : null
  }
  if (left.length === 1) return letters(left) === 'P' ? 'P' : null
  return null
}

/** Prova le code possibili della parte prima del trattino (può avere rumore attaccato davanti). */
function withHyphen(left: string, right: string): string | null {
  const number = digits(right)
  if (!number) return null
  for (const length of [5, 4, 1]) {
    if (left.length < length) continue
    const prefix = codePrefix(left.slice(-length))
    if (prefix) return `${prefix}-${number}`
  }
  return null
}

/** Senza trattino si accettano solo le forme lunghe (OP01001, PRB01001): P001 è troppo vago. */
function withoutHyphen(token: string): string | null {
  const prefix = codePrefix(token.slice(0, -3))
  const number = digits(token.slice(-3))
  return prefix && prefix !== 'P' && number ? `${prefix}-${number}` : null
}

/** Tutti i Card Code nel testo dell'OCR, corretti, una volta sola e nell'ordine in cui compaiono. */
export function cardCodesIn(text: string): string[] {
  const clean = text
    .toUpperCase()
    // Barre e punti esclamativi isolati sono bordi o rumore; attaccati a un codice sono degli 1.
    .replace(/(^|\s)[|!]+(?=\s|$)/g, '$1')
    .replace(/[|!]/g, 'I')
    .replace(/[–—_~=]/g, '-')

  const found: { index: number; code: string }[] = []
  // Dopo le tre cifre può esserci altro attaccato (la rarità "SR", il Block): si ignora.
  for (const m of clean.matchAll(/(?<![A-Z0-9])([A-Z0-9]{1,8})\s*-\s*([A-Z0-9]{3})/g)) {
    const code = withHyphen(m[1] ?? '', m[2] ?? '')
    if (code) found.push({ index: m.index, code })
  }
  for (const m of clean.matchAll(/(?<![A-Z0-9-])([A-Z0-9]{7,8})(?![A-Z0-9-])/g)) {
    const code = withoutHyphen(m[1] ?? '')
    if (code) found.push({ index: m.index, code })
  }
  return [...new Set(found.sort((a, b) => a.index - b.index).map((f) => f.code))]
}

export interface Recognition {
  /** Card Code letti che esistono nel catalogo. */
  found: string[]
  /** Letti ma non nel catalogo: probabilmente sbagliati, da correggere a mano. */
  unknown: string[]
}

export function recognize(text: string, catalogCodes: ReadonlySet<string>): Recognition {
  const codes = cardCodesIn(text)
  return {
    found: codes.filter((code) => catalogCodes.has(code)),
    unknown: codes.filter((code) => !catalogCodes.has(code)),
  }
}
