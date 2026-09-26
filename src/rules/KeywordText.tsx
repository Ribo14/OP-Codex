import { Link } from 'react-router'
import { entryForKeyword } from './glossary'
import { glossaryPath } from './paths'

// Il testo ufficiale di una Card con le Keyword tra parentesi quadre ([Blocker], [DON!! x1])
// toccabili: portano alla loro voce del glossario (RIB-51). Tutto resta testo: nessun HTML.

const BRACKETS = /(\[[^\]]+\])/

export function KeywordText({ text }: { text: string }) {
  return (
    <>
      {text.split(BRACKETS).map((part, i) => {
        const entry = BRACKETS.test(part) ? entryForKeyword(part.slice(1, -1)) : undefined
        if (!entry) return part
        return (
          <Link
            // I pezzi non cambiano ordine: l'indice basta come chiave.
            key={i}
            to={glossaryPath(entry.id)}
            className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            {part}
          </Link>
        )
      })}
    </>
  )
}
