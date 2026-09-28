import { useEffect, useState } from 'react'

// RIB-38: al posto della sola scritta di caricamento, il logo che ondeggia. Compare dopo 200 ms,
// così le aperture con il catalogo già sul dispositivo (una frazione di secondo) non lampeggiano.
// Con "riduci movimento" il logo resta fermo. Il testo resta per i lettori di schermo.

const DELAY_MS = 200

export function LogoLoader({ label }: { label: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(true)
    }, DELAY_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [])
  return (
    <div role="status" className="flex flex-col items-center gap-4 py-16">
      <img
        src="/logo.png"
        alt=""
        width={256}
        height={256}
        draggable={false}
        className={
          visible
            ? 'size-24 animate-logo-sway drop-shadow-md select-none motion-reduce:animate-none'
            : 'size-24 opacity-0'
        }
      />
      <p className={visible ? 'text-sm text-muted-foreground' : 'sr-only'}>{label}</p>
    </div>
  )
}
