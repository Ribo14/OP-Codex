import { CloudDownload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useOnline } from '@/lib/use-online'
import { allImageUrls, estimateBytes } from './image-download'
import { useCatalog } from './local-catalog'
import { useOfflineImages } from './offline-images'

// Impostazioni → "Immagini offline" (RIB-37): tutte le immagini del catalogo sul dispositivo,
// con stima dello spazio, avanzamento, interruzione e ripresa, e la possibilità di liberarle.

/** "550 MB", "1,2 GB". */
function formatBytes(bytes: number, language: string): string {
  const gb = bytes >= 1e9
  return new Intl.NumberFormat(language, {
    style: 'unit',
    unit: gb ? 'gigabyte' : 'megabyte',
    maximumFractionDigits: gb ? 1 : 0,
  }).format(gb ? bytes / 1e9 : Math.max(1, Math.round(bytes / 1e6)))
}

/** Spazio che il browser concede ancora all'app, se lo dichiara. */
function useFreeSpace(refreshKey: unknown): number | null {
  const [free, setFree] = useState<number | null>(null)
  useEffect(() => {
    let active = true
    const read = async () => {
      try {
        const { quota, usage } = await navigator.storage.estimate()
        if (active && quota !== undefined) setFree(Math.max(0, quota - (usage ?? 0)))
      } catch {
        /* stima non disponibile: non la si mostra */
      }
    }
    void read()
    return () => {
      active = false
    }
  }, [refreshKey])
  return free
}

export function OfflineImagesSettings() {
  const { t, i18n } = useTranslation()
  const online = useOnline()
  const { catalog } = useCatalog()
  const urls = useMemo(() => (catalog ? allImageUrls(catalog.cards) : []), [catalog])
  const images = useOfflineImages(urls)
  const [confirmClear, setConfirmClear] = useState(false)
  const free = useFreeSpace(images.phase === 'running' ? 'running' : images.cached)
  const size = (bytes: number) => formatBytes(bytes, i18n.language)

  if (!catalog || images.cached === null) {
    return <p className="text-sm text-muted-foreground">{t('settings.images.counting')}</p>
  }

  const running = images.phase === 'running'
  const needed = estimateBytes(images.missing)
  const tooBig = free !== null && needed > free
  const failed = images.phase === 'done' ? (images.progress?.failed ?? 0) : 0

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">{t('settings.images.intro')}</p>

      <div className="space-y-2" aria-live="polite">
        <p className="font-medium">
          {t('settings.images.onDevice', { cached: images.cached, total: images.total })}
        </p>
        <progress
          className="h-2 w-full accent-foreground"
          max={Math.max(images.total, 1)}
          value={images.cached}
          aria-label={t('settings.images.progressLabel')}
        />
        {running && <p className="text-muted-foreground">{t('settings.images.keepOpen')}</p>}
        {!running && images.missing.length === 0 && (
          <p className="text-muted-foreground">{t('settings.images.allDone')}</p>
        )}
        {!running && images.missing.length > 0 && (
          <p className="text-muted-foreground">
            {t('settings.images.toDownload', {
              count: images.missing.length,
              size: size(needed),
            })}
            {free !== null && ` ${t('settings.images.free', { size: size(free) })}`}
          </p>
        )}
        {!running && tooBig && images.missing.length > 0 && (
          <p role="alert" className="text-destructive">
            {t('settings.images.noSpace')}
          </p>
        )}
        {images.phase === 'stopped' && (
          <p className="text-muted-foreground">{t('settings.images.stopped')}</p>
        )}
        {failed > 0 && (
          <p className="text-muted-foreground">{t('offline.setPartial', { count: failed })}</p>
        )}
        {!online && !running && images.missing.length > 0 && (
          <p className="text-muted-foreground">{t('settings.images.offline')}</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {running ? (
          <button
            type="button"
            onClick={images.stop}
            className="inline-flex h-10 items-center rounded-full border px-4 font-medium hover:bg-muted"
          >
            {t('settings.images.stop')}
          </button>
        ) : (
          images.missing.length > 0 && (
            <button
              type="button"
              disabled={!online || tooBig}
              onClick={() => {
                setConfirmClear(false)
                void images.start()
              }}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 font-medium text-background disabled:opacity-50"
            >
              <CloudDownload className="size-4" aria-hidden="true" />
              {images.cached === 0 ? t('settings.images.downloadAll') : t('settings.images.resume')}
            </button>
          )
        )}
        {!running && images.cached > 0 && !confirmClear && (
          <button
            type="button"
            onClick={() => {
              setConfirmClear(true)
            }}
            className="inline-flex h-10 items-center rounded-full px-4 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {t('settings.images.clear')}
          </button>
        )}
      </div>

      {confirmClear && !running && (
        <div
          role="alertdialog"
          aria-labelledby="conferma-elimina"
          className="space-y-3 rounded-2xl border p-4"
        >
          <p id="conferma-elimina">
            {t('settings.images.clearConfirm', {
              count: images.cached,
              size: size(estimateBytes(urls) - needed),
            })}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmClear(false)
                void images.clear()
              }}
              className="inline-flex h-9 items-center rounded-full bg-destructive px-4 font-medium text-white"
            >
              {t('settings.images.clearYes')}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirmClear(false)
              }}
              className="inline-flex h-9 items-center rounded-full px-4 hover:bg-muted"
            >
              {t('settings.images.clearNo')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
