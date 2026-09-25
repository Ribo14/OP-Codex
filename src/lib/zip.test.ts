import { describe, expect, it } from 'vitest'
import { crc32, createZip } from './zip'

/** Legge un ZIP "store" dalla directory centrale: nome → testo. */
function readZip(zip: Uint8Array): Map<string, string> {
  const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const endAt = zip.length - 22
  expect(view.getUint32(endAt, true)).toBe(0x06054b50)
  const count = view.getUint16(endAt + 10, true)
  let at = view.getUint32(endAt + 16, true)
  const decoder = new TextDecoder()
  const files = new Map<string, string>()
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50)
    const size = view.getUint32(at + 20, true)
    const nameLength = view.getUint16(at + 28, true)
    const localAt = view.getUint32(at + 42, true)
    const name = decoder.decode(zip.subarray(at + 46, at + 46 + nameLength))
    const localName = view.getUint16(localAt + 26, true)
    const dataAt = localAt + 30 + localName
    const data = zip.subarray(dataAt, dataAt + size)
    expect(crc32(data)).toBe(view.getUint32(at + 16, true))
    files.set(name, decoder.decode(data))
    at += 46 + nameLength
  }
  return files
}

describe('ZIP senza compressione', () => {
  it('CRC-32 standard', () => {
    expect(crc32(new TextEncoder().encode('123456789'))).toBe(0xcbf43926)
  })

  it('contiene i file con nomi e testo UTF-8', () => {
    const zip = createZip([
      { name: 'LEGGIMI.txt', content: 'Ciao' },
      { name: 'mazzi/Rufy è forte.txt', content: '1xOP01-001\n4xOP01-016' },
    ])
    expect(readZip(zip)).toEqual(
      new Map([
        ['LEGGIMI.txt', 'Ciao'],
        ['mazzi/Rufy è forte.txt', '1xOP01-001\n4xOP01-016'],
      ]),
    )
  })

  it('archivio vuoto valido', () => {
    expect(readZip(createZip([])).size).toBe(0)
  })
})
