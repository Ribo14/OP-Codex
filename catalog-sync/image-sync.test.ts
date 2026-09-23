import sharp from 'sharp'
import { beforeAll, describe, expect, it } from 'vitest'
import {
  convertCardImage,
  imagePath,
  syncImages,
  type ImageStore,
  type ImageSyncRepository,
} from './image-sync.ts'

let officialPng: Uint8Array

beforeAll(async () => {
  // Un PNG con le dimensioni delle immagini ufficiali (600×838).
  officialPng = await sharp({
    create: { width: 600, height: 838, channels: 3, background: '#c0392b' },
  })
    .png()
    .toBuffer()
})

/** Repository in memoria: stesse regole di quello su Postgres. */
function memoryRepository(printIds: string[]) {
  const synced = new Set<string>()
  const repository: ImageSyncRepository = {
    pendingPrintIds: (limit) =>
      Promise.resolve(printIds.filter((id) => !synced.has(id)).slice(0, limit)),
    countPending: () => Promise.resolve(printIds.filter((id) => !synced.has(id)).length),
    markSynced: (printId) => {
      synced.add(printId)
      return Promise.resolve()
    },
  }
  return { repository, synced }
}

function memoryStore() {
  const files = new Map<string, Buffer>()
  const store: ImageStore = {
    upload: (path, data) => {
      files.set(path, data)
      return Promise.resolve()
    },
  }
  return { store, files }
}

function setup(printIds: string[], failing: string[] = []) {
  const { repository, synced } = memoryRepository(printIds)
  const { store, files } = memoryStore()
  const fetched: string[] = []
  const sleeps: number[] = []
  const options = {
    repository,
    store,
    fetchImage: (printId: string) => {
      fetched.push(printId)
      return failing.includes(printId)
        ? Promise.reject(new Error('HTTP 404'))
        : Promise.resolve(officialPng)
    },
    delayMs: 2000,
    sleep: (ms: number) => {
      sleeps.push(ms)
      return Promise.resolve()
    },
  }
  return { options, synced, files, fetched, sleeps }
}

describe('convertCardImage', () => {
  it('produce una miniatura da 300 px e un’immagine completa da 600 px, in WebP', async () => {
    const { thumb, full } = await convertCardImage(officialPng)

    const thumbMeta = await sharp(thumb).metadata()
    const fullMeta = await sharp(full).metadata()
    expect(thumbMeta).toMatchObject({ format: 'webp', width: 300, height: 419 })
    expect(fullMeta).toMatchObject({ format: 'webp', width: 600, height: 838 })
  })
})

describe('syncImages', () => {
  it('carica thumb e full per ogni Printing e la segna come sincronizzata', async () => {
    const { options, synced, files } = setup(['OP01-001', 'OP01-001_p1'])

    const result = await syncImages({ ...options, limit: 10 })

    expect(result).toEqual({ synced: ['OP01-001', 'OP01-001_p1'], failed: [], remaining: 0 })
    expect([...files.keys()].sort()).toEqual([
      'full/OP01-001.webp',
      'full/OP01-001_p1.webp',
      'thumb/OP01-001.webp',
      'thumb/OP01-001_p1.webp',
    ])
    expect([...synced]).toEqual(['OP01-001', 'OP01-001_p1'])
  })

  it('lanciato due volte non riscarica le immagini già presenti', async () => {
    const { options, fetched } = setup(['OP01-001', 'OP01-002'])

    await syncImages({ ...options, limit: 10 })
    const second = await syncImages({ ...options, limit: 10 })

    expect(second).toEqual({ synced: [], failed: [], remaining: 0 })
    expect(fetched).toEqual(['OP01-001', 'OP01-002'])
  })

  it('rispetta il limite per esecuzione e riprende da dove si era fermato', async () => {
    const { options, fetched } = setup(['OP01-001', 'OP01-002', 'OP01-003', 'OP01-004', 'OP01-005'])

    const first = await syncImages({ ...options, limit: 2 })
    expect(first.synced).toEqual(['OP01-001', 'OP01-002'])
    expect(first.remaining).toBe(3)

    const second = await syncImages({ ...options, limit: 2 })
    expect(second.synced).toEqual(['OP01-003', 'OP01-004'])
    expect(second.remaining).toBe(1)
    expect(fetched).toHaveLength(4)
  })

  it('fa una pausa tra una richiesta e la successiva, non dopo l’ultima', async () => {
    const { options, sleeps } = setup(['OP01-001', 'OP01-002', 'OP01-003'])

    await syncImages({ ...options, limit: 10 })

    expect(sleeps).toEqual([2000, 2000])
  })

  it('un errore non ferma le altre Printing e lascia quella fallita da riscaricare', async () => {
    const { options, synced } = setup(['OP01-001', 'OP01-002', 'OP01-003'], ['OP01-002'])

    const result = await syncImages({ ...options, limit: 10 })

    expect(result.synced).toEqual(['OP01-001', 'OP01-003'])
    expect(result.failed).toEqual([{ printId: 'OP01-002', error: 'HTTP 404' }])
    expect(result.remaining).toBe(1)
    expect(synced.has('OP01-002')).toBe(false)
  })

  it('rifiuta limiti e pause non validi', async () => {
    const { options } = setup([])
    await expect(syncImages({ ...options, limit: -1 })).rejects.toThrow('Limite non valido')
    await expect(syncImages({ ...options, limit: 1, delayMs: 1.5 })).rejects.toThrow(
      'Pausa non valida',
    )
  })
})

describe('imagePath', () => {
  it('separa le due versioni in cartelle', () => {
    expect(imagePath('thumb', 'OP01-001_p1')).toBe('thumb/OP01-001_p1.webp')
    expect(imagePath('full', 'OP01-001_p1')).toBe('full/OP01-001_p1.webp')
  })
})
