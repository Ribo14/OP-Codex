// Il markdown semplice delle Card Explanation (RIB-52): paragrafi separati da una riga vuota,
// elenchi con "- " e grassetto con **testo**. Nient'altro: niente HTML, link o immagini, che
// restano testo così com'è. Qui solo la struttura; la resa è in CardExplanation.

export interface Inline {
  text: string
  bold: boolean
}

export type Block = { kind: 'paragraph'; lines: Inline[][] } | { kind: 'list'; items: Inline[][] }

/** Il grassetto in una riga: **così**. Un ** senza chiusura resta testo. */
export function parseInline(line: string): Inline[] {
  const parts = line.split(/\*\*([^*]+)\*\*/)
  return parts.map((text, i) => ({ text, bold: i % 2 === 1 })).filter((part) => part.text !== '')
}

export function parseExplanation(markdown: string): Block[] {
  return markdown
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0)
    .map((lines): Block =>
      lines.every((line) => line.startsWith('- '))
        ? { kind: 'list', items: lines.map((line) => parseInline(line.slice(2))) }
        : { kind: 'paragraph', lines: lines.map(parseInline) },
    )
}
