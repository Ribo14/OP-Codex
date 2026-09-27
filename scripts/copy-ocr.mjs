// Copia in public/ocr i file dell'OCR dello Scanner (Tesseract.js, fase 4) dalle dipendenze:
// la CSP permette solo script e dati dal nostro dominio, niente CDN. Gira da solo prima di
// `npm run dev` e `npm run build`; la cartella non entra nel repo (.gitignore).
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const target = fileURLToPath(new URL('../public/ocr/', import.meta.url))
const tesseract = dirname(require.resolve('tesseract.js/package.json'))
const core = dirname(require.resolve('tesseract.js-core/package.json'))
const eng = dirname(require.resolve('@tesseract.js-data/eng/package.json'))

const files = [
  [join(tesseract, 'dist/worker.min.js'), 'worker.min.js'],
  // Solo i motori LSTM (quelli che usa Tesseract.js con OEM 1); lo sceglie il worker.
  [join(core, 'tesseract-core-lstm.wasm.js'), 'tesseract-core-lstm.wasm.js'],
  [join(core, 'tesseract-core-simd-lstm.wasm.js'), 'tesseract-core-simd-lstm.wasm.js'],
  [
    join(core, 'tesseract-core-relaxedsimd-lstm.wasm.js'),
    'tesseract-core-relaxedsimd-lstm.wasm.js',
  ],
  // Modello inglese "best_int": più preciso del "fast" e comunque piccolo (~3 MB).
  [join(eng, '4.0.0_best_int/eng.traineddata.gz'), 'lang/eng.traineddata.gz'],
]

mkdirSync(join(target, 'lang'), { recursive: true })
for (const [from, to] of files) copyFileSync(from, join(target, to))
console.log(`OCR: ${String(files.length)} file copiati in public/ocr`)
