import { Download, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { clearCrops, cropsZip, listCrops, MAX_CROPS, useDiagnostics } from './scan-diagnostics'

/** Scarica un file creato sul dispositivo. */
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 60_000)
}

/**
 * Diagnostica dello Scanner (RIB-87): nell'area Admin con l'interruttore, nello Scanner solo il
 * conteggio e i pulsanti (e solo se è accesa). `refreshKey` cambia quando lo Scanner salva un
 * ritaglio, così il numero si aggiorna.
 */
export function DiagnosticsControls({
  withToggle = false,
  refreshKey = 0,
}: {
  withToggle?: boolean
  refreshKey?: number
}) {
  const { t } = useTranslation()
  const { enabled, count, refresh, toggle } = useDiagnostics(refreshKey)

  if (!withToggle && !enabled) return null
  return (
    <section
      aria-label={t('scanner.diagnostics.title')}
      className="space-y-3 rounded-2xl border p-4 text-sm"
    >
      {withToggle && (
        <>
          <h2 className="text-lg font-semibold tracking-tight">{t('scanner.diagnostics.title')}</h2>
          <p className="text-muted-foreground">
            {t('scanner.diagnostics.text', { max: MAX_CROPS })}
          </p>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => {
                toggle(e.target.checked)
              }}
              className="size-4 accent-foreground"
            />
            {t('scanner.diagnostics.toggle')}
          </label>
        </>
      )}
      {enabled && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground" aria-live="polite">
            {t('scanner.diagnostics.count', { count })}
          </span>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => {
              void listCrops()
                .then(cropsZip)
                .then((zip) => {
                  download(zip, `scanner-diagnostica-${new Date().toISOString().slice(0, 10)}.zip`)
                })
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <Download className="size-3.5" aria-hidden="true" />
            {t('scanner.diagnostics.export')}
          </button>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => {
              void clearCrops().then(refresh)
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t('scanner.diagnostics.clear')}
          </button>
        </div>
      )}
    </section>
  )
}
