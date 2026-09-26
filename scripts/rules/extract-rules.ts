// Estrae le Comprehensive Rules dal PDF ufficiale in src/rules/comprehensive-rules.json (RIB-53).
// Uso: node scripts/rules/extract-rules.ts [pdf] [uscita]
// Serve pdftotext (Poppler; su Windows c'è con Git for Windows in /mingw64/bin). Da rilanciare
// quando Bandai pubblica una nuova versione del regolamento, poi controllare il diff.

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { parseRulesText } from '../../src/rules/rules-text.ts'

const pdf = process.argv[2] ?? 'docs/Regole One Piece Card/rule_comprehensive.pdf'
const out = process.argv[3] ?? 'src/rules/comprehensive-rules.json'

const text = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', pdf, '-'], {
  encoding: 'utf8',
  maxBuffer: 20 * 1024 * 1024,
})
const doc = parseRulesText(text)
writeFileSync(out, `${JSON.stringify(doc, null, 1)}\n`)
console.log(
  `Regolamento ${doc.version} (${doc.updated}): ${String(doc.rules.length)} regole → ${out}`,
)
