import { describe, expect, it, vi } from 'vitest'
import type { CatalogCard } from './catalog-data'
import { downloadImages, setImageUrls } from './image-download'

const ok = () => Promise.resolve(new Response('img'))

describe('download delle immagini di un Set', () => {
  it('scarica tutto in parallelo limitato e conta i fallimenti', async () => {
    let active = 0
    let peak = 0
    const fetcher = vi.fn<typeof fetch>(async (input) => {
      active++
      peak = Math.max(peak, active)
      await new Promise((r) => setTimeout(r, 1))
      active--
      if (input === 'bad') return new Response('', { status: 404 })
      return ok()
    })
    const urls = [...Array.from({ length: 20 }, (_, i) => `u${String(i)}`), 'bad']
    const onProgress = vi.fn()
    const result = await downloadImages(urls, { fetcher, onProgress })

    expect(result).toEqual({ done: 20, failed: 1, total: 21 })
    expect(fetcher).toHaveBeenCalledTimes(21)
    expect(peak).toBeLessThanOrEqual(6)
    expect(onProgress).toHaveBeenLastCalledWith({ done: 20, failed: 1, total: 21 })
    expect(fetcher).toHaveBeenCalledWith('u0', expect.objectContaining({ mode: 'cors' }))
  })

  it('un errore di rete conta come fallimento, senza fermare il resto', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockImplementation(ok)
    const result = await downloadImages(['a', 'b', 'c'], { fetcher })
    expect(result).toEqual({ done: 2, failed: 1, total: 3 })
  })

  it('si ferma quando viene annullato', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn<typeof fetch>(() => {
      controller.abort()
      return ok()
    })
    const urls = Array.from({ length: 50 }, (_, i) => `u${String(i)}`)
    await downloadImages(urls, { fetcher, signal: controller.signal })
    expect(fetcher.mock.calls.length).toBeLessThanOrEqual(6)
  })

  it('prende miniatura e immagine grande delle sole Printing del Set con immagine', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    const cards = [
      {
        printings: [
          { printId: 'OP01-001', rarity: 'L', setCode: 'OP-01', hasImage: true },
          { printId: 'OP01-001_p1', rarity: 'L', setCode: 'OP-01', hasImage: false },
          { printId: 'OP01-001_r1', rarity: 'L', setCode: 'PRB-01', hasImage: true },
        ],
      },
    ] as CatalogCard[]
    const urls = setImageUrls(cards, 'OP-01')
    expect(urls).toHaveLength(2)
    expect(urls[0]).toMatch(/\/thumb\/OP01-001\.webp$/)
    expect(urls[1]).toMatch(/\/full\/OP01-001\.webp$/)
    vi.unstubAllEnvs()
  })
})
