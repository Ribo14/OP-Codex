import { describe, expect, it } from 'vitest'
import { cardFrame, clampRect, codeZone, codeZones, toPreview, toVideo } from './scan-geometry'

// Riquadro della carta sull'anteprima e zona del Card Code, riportata sui pixel del video.

describe('cardFrame', () => {
  it('su un telefono in verticale la carta prende l’80% dell’altezza, al centro', () => {
    const frame = cardFrame({ width: 400, height: 600 })
    expect(frame.height).toBeCloseTo(480)
    expect(frame.width).toBeCloseTo(480 * (63 / 88))
    expect(frame.x + frame.width / 2).toBeCloseTo(200)
    expect(frame.y + frame.height / 2).toBeCloseTo(300)
  })

  it('in uno spazio stretto si limita al 90% della larghezza', () => {
    const frame = cardFrame({ width: 300, height: 900 })
    expect(frame.width).toBeCloseTo(270)
    expect(frame.height).toBeCloseTo(270 * (88 / 63))
  })
})

describe('codeZone', () => {
  it('è la parte in basso a destra della carta', () => {
    const zone = codeZone({ x: 0, y: 0, width: 630, height: 880 })
    expect(zone.x).toBeGreaterThanOrEqual(630 * 0.4)
    expect(zone.x + zone.width).toBeCloseTo(630)
    expect(zone.y).toBeGreaterThanOrEqual(880 * 0.8)
    expect(zone.y + zone.height).toBeCloseTo(880)
  })
})

describe('codeZones e toPreview (RIB-84, RIB-85)', () => {
  it('la zona ampia contiene quella storica e resta dentro la carta', () => {
    const card = { x: 100, y: 50, width: 630, height: 880 }
    const { app, wide } = codeZones(card)
    expect(app).toEqual(codeZone(card))
    expect(wide.x).toBeLessThanOrEqual(app.x)
    expect(wide.y).toBeLessThanOrEqual(app.y)
    expect(wide.x + wide.width).toBeCloseTo(card.x + card.width)
    expect(wide.y + wide.height).toBeCloseTo(card.y + card.height)
  })

  it('toPreview è l’inverso di toVideo', () => {
    const box = { width: 390, height: 520 }
    const video = { width: 1080, height: 1920 }
    const rect = { x: 120, y: 90, width: 150, height: 210 }
    const back = toPreview(toVideo(rect, box, video), box, video)
    expect(back.x).toBeCloseTo(rect.x)
    expect(back.y).toBeCloseTo(rect.y)
    expect(back.width).toBeCloseTo(rect.width)
    expect(back.height).toBeCloseTo(rect.height)
  })

  it('clampRect non esce dal video', () => {
    expect(
      clampRect({ x: -10, y: 5, width: 50, height: 2000 }, { width: 100, height: 100 }),
    ).toEqual({ x: 0, y: 5, width: 40, height: 95 })
  })
})

describe('toVideo', () => {
  it('senza ritaglio (stesse proporzioni) scala e basta', () => {
    const rect = toVideo(
      { x: 100, y: 50, width: 200, height: 100 },
      { width: 400, height: 300 },
      { width: 1600, height: 1200 },
    )
    expect(rect).toEqual({ x: 400, y: 200, width: 800, height: 400 })
  })

  it('con object-cover tiene conto della parte di video tagliata ai lati', () => {
    // Video 16:9 in un riquadro verticale: si vede solo la fascia centrale.
    const rect = toVideo(
      { x: 0, y: 0, width: 360, height: 640 },
      { width: 360, height: 640 },
      { width: 1920, height: 1080 },
    )
    // Scala 640/1080: larghezza visibile 360 / (640/1080) = 607,5 px di video, centrata.
    expect(rect.x).toBeCloseTo((1920 - 607.5) / 2)
    expect(rect.width).toBeCloseTo(607.5)
    expect(rect.y).toBe(0)
    expect(rect.height).toBe(1080)
  })

  it('non esce mai dal video', () => {
    const rect = toVideo(
      { x: -50, y: -50, width: 1000, height: 1000 },
      { width: 400, height: 300 },
      { width: 400, height: 300 },
    )
    expect(rect).toEqual({ x: 0, y: 0, width: 400, height: 300 })
  })
})
