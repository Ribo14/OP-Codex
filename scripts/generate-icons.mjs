// Genera le icone della PWA e la favicon a partire dal logo in brand/logo.png.
// Per cambiare logo: sostituire brand/logo.png (quadrato, almeno 512 px, sfondo trasparente) e
// rilanciare `npm run icons`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SOURCE = fileURLToPath(new URL('../brand/logo.png', import.meta.url))
/** Colore di fondo delle icone a tutto quadrato (maskable, iOS), che non ammettono trasparenza. */
const BACKGROUND = '#07090b'

/**
 * `inset` riduce il logo dentro la tela (area sicura delle icone maskable); `fill` riempie la
 * tela col colore di fondo invece di lasciarla trasparente. Il logo ha già lo sfondo
 * trasparente: niente ritagli, le carte e il timone che escono dal cerchio restano interi.
 */
async function icon({ size, inset, fill }) {
  const inner = Math.round(size * (1 - inset * 2))
  const logo = await sharp(SOURCE).resize(inner, inner).png().toBuffer()
  const offset = Math.round((size - inner) / 2)
  return (
    sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: fill ? BACKGROUND : { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: logo, left: offset, top: offset }])
      // PNG a tavolozza: circa un quarto del peso, differenza invisibile a queste dimensioni.
      .png({ palette: true, quality: 95, effort: 10, compressionLevel: 9 })
  )
}

const ICONS = [
  // Icone normali: trasparenza intorno.
  { file: 'icons/icon-192.png', size: 192, inset: 0, fill: false },
  { file: 'icons/icon-512.png', size: 512, inset: 0, fill: false },
  // Maskable: sfondo pieno fino ai bordi, logo dentro il cerchio sicuro (40% del lato) che
  // Android non ritaglia mai: le punte delle carte arrivano giusto al bordo del cerchio.
  { file: 'icons/maskable-512.png', size: 512, inset: 0.1, fill: true },
  // iOS: niente trasparenza, gli angoli li arrotonda il sistema.
  { file: 'icons/apple-touch-icon.png', size: 180, inset: 0.06, fill: true },
  // Favicon della scheda del browser.
  { file: 'favicon.png', size: 64, inset: 0, fill: false },
  // Logo dentro l'app (intestazione, barra laterale, caricamento): fondo trasparente.
  { file: 'logo.png', size: 256, inset: 0, fill: false },
]

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true })

for (const spec of ICONS) {
  await (await icon(spec)).toFile(fileURLToPath(new URL(`../public/${spec.file}`, import.meta.url)))
  console.log(`public/${spec.file} (${String(spec.size)}×${String(spec.size)})`)
}
