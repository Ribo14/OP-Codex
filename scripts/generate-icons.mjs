// Genera le icone della PWA e la favicon a partire dal logo in brand/logo.png.
// Per cambiare logo: sostituire brand/logo.png (quadrato, almeno 512 px) e rilanciare
// `npm run icons`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const SOURCE = fileURLToPath(new URL('../brand/logo.png', import.meta.url))
/** Colore di fondo del logo: riempie le icone a tutto quadrato (maskable, iOS). */
const BACKGROUND = '#07090b'
/** Raggio degli angoli, in proporzione al lato (toglie gli angoli neri del disegno). */
const CORNER = 0.22

/** Raggio del medaglione tondo del logo, in proporzione al lato (anello dorato compreso). */
const MEDALLION = 0.475

/**
 * Il logo al lato richiesto, ritagliato: "rounded" = riquadro con angoli arrotondati e
 * trasparenti; "circle" = solo il medaglione, per le icone su fondo pieno (niente bordo del
 * riquadro che si intravede).
 */
async function roundedLogo(size, shape) {
  const shapeSvg =
    shape === 'circle'
      ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size * MEDALLION}" fill="#fff"/>`
      : `<rect width="${size}" height="${size}" rx="${Math.round(size * CORNER)}" fill="#fff"/>`
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">${shapeSvg}</svg>`,
  )
  return sharp(SOURCE)
    .resize(size, size)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/**
 * `inset` riduce il logo dentro la tela (area sicura delle icone maskable); `fill` riempie la
 * tela col colore di fondo invece di lasciare gli angoli trasparenti.
 */
async function icon({ size, inset, fill, shape }) {
  const inner = Math.round(size * (1 - inset * 2))
  const logo = await roundedLogo(inner, shape ?? (fill ? 'circle' : 'rounded'))
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
  // Icone normali: angoli arrotondati, trasparenza intorno.
  { file: 'icons/icon-192.png', size: 192, inset: 0, fill: false },
  { file: 'icons/icon-512.png', size: 512, inset: 0, fill: false },
  // Maskable: sfondo pieno fino ai bordi, medaglione dentro il cerchio sicuro (40% del lato)
  // che Android non ritaglia mai.
  { file: 'icons/maskable-512.png', size: 512, inset: 0.1, fill: true },
  // iOS: niente trasparenza, gli angoli li arrotonda il sistema.
  { file: 'icons/apple-touch-icon.png', size: 180, inset: 0.02, fill: true },
  // Favicon della scheda del browser.
  { file: 'favicon.png', size: 64, inset: 0, fill: false },
  // Logo dentro l'app (intestazione e barra laterale): solo il medaglione, fondo trasparente.
  { file: 'logo.png', size: 256, inset: 0, fill: false, shape: 'circle' },
]

mkdirSync(new URL('../public/icons/', import.meta.url), { recursive: true })

for (const spec of ICONS) {
  await (await icon(spec)).toFile(fileURLToPath(new URL(`../public/${spec.file}`, import.meta.url)))
  console.log(`public/${spec.file} (${String(spec.size)}×${String(spec.size)})`)
}
