// Genera e2e/fixtures/scanner-card.mjpeg: il "video" della fotocamera finta di Chromium per il test
// dello Scanner (fase 4). Una carta disegnata da noi (niente immagini Bandai) con il Card Code di
// prova EB99-042 nell'angolo in basso a destra, dove sta sulle carte vere, e inquadrata come
// chiede il riquadro dello Scanner. Il video è 1920×1080 come una fotocamera vera (Chromium lo
// adatterebbe comunque alla risoluzione chiesta); l'anteprima 3:4 ne mostra la fascia centrale,
// alta come il video: la carta prende l'80% dell'altezza, al centro.
// Uso: node e2e/fixtures/make-scanner-video.mjs
import { writeFileSync } from 'node:fs'
import sharp from 'sharp'

const WIDTH = 1920
const HEIGHT = 1080
const cardHeight = HEIGHT * 0.8
const cardWidth = cardHeight * (63 / 88)
const x = (WIDTH - cardWidth) / 2
const y = (HEIGHT - cardHeight) / 2
const at = (fx, fy) => [x + cardWidth * fx, y + cardHeight * fy]

const [codeX, codeY] = at(0.79, 0.95)
const [typeX, typeY] = at(0.5, 0.945)
const [nameX, nameY] = at(0.5, 0.88)

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <rect width="100%" height="100%" fill="#2b2b2b"/>
  <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="28" fill="#f2efe6"/>
  <rect x="${x + 30}" y="${y + 30}" width="${cardWidth - 60}" height="${cardHeight * 0.72}" rx="12" fill="#c9533f"/>
  <text x="${nameX}" y="${nameY}" font-family="Arial" font-size="44" font-weight="bold" text-anchor="middle" fill="#222">Carta di prova</text>
  <text x="${typeX}" y="${typeY}" font-family="Arial" font-size="22" text-anchor="end" fill="#444">Scanner/E2E</text>
  <text x="${codeX}" y="${codeY}" font-family="Arial" font-size="26" text-anchor="middle" fill="#222">EB99-042</text>
  <rect x="${codeX + 62}" y="${codeY - 22}" width="36" height="26" rx="6" fill="#222"/>
  <text x="${codeX + 80}" y="${codeY - 3}" font-family="Arial" font-size="18" text-anchor="middle" fill="#fff">SR</text>
</svg>`

const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toBuffer()
writeFileSync(new URL('./scanner-card.mjpeg', import.meta.url), jpeg)
console.log(`scanner-card.mjpeg: ${String(jpeg.length)} byte`)
