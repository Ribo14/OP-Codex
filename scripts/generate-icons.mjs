// Genera le icone della PWA in public/icons a partire da un disegno SVG.
// Sono segnaposto con la scritta "OP-Codex": quando arriverà il logo definitivo basterà
// sostituire LOGO_SVG (o leggerlo da un file) e rilanciare `npm run icons`.
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const BACKGROUND = '#0b0f19'
const FOREGROUND = '#f5f5f5'

/** Disegno su una tela quadrata; `inset` riduce il contenuto (area sicura delle icone maskable). */
function logoSvg({ rounded, inset }) {
  const size = 512
  const scale = 1 - inset * 2
  const offset = size * inset
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? 112 : 0}" fill="${BACKGROUND}"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <text x="256" y="268" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
      font-size="230" font-weight="800" fill="${FOREGROUND}" letter-spacing="-8">OP</text>
    <text x="256" y="372" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif"
      font-size="92" font-weight="600" fill="${FOREGROUND}" opacity="0.8">Codex</text>
  </g>
</svg>`
}

const ICONS = [
  // Icone normali: angoli arrotondati, trasparenza intorno.
  { file: 'icon-192.png', size: 192, rounded: true, inset: 0 },
  { file: 'icon-512.png', size: 512, rounded: true, inset: 0 },
  // Maskable: sfondo pieno fino ai bordi, disegno nell'80% centrale (Android lo ritaglia).
  { file: 'maskable-512.png', size: 512, rounded: false, inset: 0.1 },
  // iOS: niente trasparenza, gli angoli li arrotonda il sistema.
  { file: 'apple-touch-icon.png', size: 180, rounded: false, inset: 0.06 },
]

const outDir = new URL('../public/icons/', import.meta.url)
mkdirSync(outDir, { recursive: true })

for (const icon of ICONS) {
  const svg = Buffer.from(logoSvg(icon))
  await sharp(svg, { density: 300 })
    .resize(icon.size, icon.size)
    .png({ compressionLevel: 9 })
    .toFile(fileURLToPath(new URL(icon.file, outDir)))
  console.log(`public/icons/${icon.file} (${String(icon.size)}×${String(icon.size)})`)
}
