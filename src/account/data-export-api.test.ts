import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deliverFile } from './data-export-api'

// Consegna del file di "Esporta i miei dati" (RIB-28): condivisione solo nella PWA di iOS,
// download ovunque altro. Su Android la condivisione di un .zip veniva rifiutata.

vi.mock('@/lib/supabase', () => ({ getSupabase: vi.fn() }))

const file = new File(['PK'], 'op-codex-rufy-2026-09-26.zip', { type: 'application/zip' })
const share = vi.fn<(data: ShareData) => Promise<void>>()
const click = vi.fn()

function device({ iosApp }: { iosApp: boolean }) {
  Object.assign(navigator, {
    standalone: iosApp ? true : undefined,
    canShare: () => true,
    share,
  })
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:export')
  URL.revokeObjectURL = vi.fn()
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)
})

afterEach(() => {
  vi.restoreAllMocks()
  share.mockReset()
  click.mockReset()
})

describe('deliverFile', () => {
  it('su Android (e sui computer) scarica il file senza passare dalla condivisione', async () => {
    device({ iosApp: false })
    share.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
    await deliverFile(file)
    expect(share).not.toHaveBeenCalled()
    expect(click).toHaveBeenCalledOnce()
  })

  it('nella PWA di iOS usa la condivisione ("Salva su File")', async () => {
    device({ iosApp: true })
    share.mockResolvedValue(undefined)
    await deliverFile(file)
    expect(share).toHaveBeenCalledWith({ files: [file] })
    expect(click).not.toHaveBeenCalled()
  })

  it('se la condivisione viene chiusa senza scegliere, non fa altro', async () => {
    device({ iosApp: true })
    share.mockRejectedValue(new DOMException('Share canceled', 'AbortError'))
    await deliverFile(file)
    expect(click).not.toHaveBeenCalled()
  })

  it('se la condivisione viene rifiutata, ripiega sul download', async () => {
    device({ iosApp: true })
    share.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'))
    await deliverFile(file)
    expect(click).toHaveBeenCalledOnce()
  })
})
