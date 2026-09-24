import { CloudDownload } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useOnline } from '@/lib/use-online'
import type { CatalogCard } from './catalog-data'
import { countCached, downloadImages, setImageUrls, type DownloadProgress } from './image-download'

type Status = { state: 'idle' } | { state: 'running' | 'done'; progress: DownloadProgress }

/** Da montare con key={setCode}: cambiare Set riparte da zero. */
export function SetImagesDownload({
  cards,
  setCode,
}: {
  cards: readonly CatalogCard[]
  setCode: string
}) {
  const { t } = useTranslation()
  const online = useOnline()
  const urls = useMemo(() => setImageUrls(cards, setCode), [cards, setCode])
  const [status, setStatus] = useState<Status>({ state: 'idle' })
  const abort = useRef<AbortController | null>(null)

  useEffect(
    () => () => {
      abort.current?.abort()
    },
    [],
  )

  // Se sono già tutte sul dispositivo lo dice subito, invece di riproporre il download.
  useEffect(() => {
    let active = true
    void countCached(urls).then((cached) => {
      if (!active || urls.length === 0 || cached < urls.length) return
      setStatus((s) =>
        s.state === 'idle'
          ? { state: 'done', progress: { done: cached, failed: 0, total: cached } }
          : s,
      )
    })
    return () => {
      active = false
    }
  }, [urls])

  if (urls.length === 0) return null

  const start = async () => {
    const controller = new AbortController()
    abort.current = controller
    const total = urls.length
    setStatus({ state: 'running', progress: { done: 0, failed: 0, total } })
    const progress = await downloadImages(urls, {
      signal: controller.signal,
      onProgress: (p) => {
        if (!controller.signal.aborted) setStatus({ state: 'running', progress: p })
      },
    })
    if (!controller.signal.aborted) setStatus({ state: 'done', progress })
  }

  const cardsCount = urls.length / 2

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 text-sm">
      <CloudDownload className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <p className="min-w-0 flex-1 basis-56" aria-live="polite">
        {status.state === 'idle' && t('offline.setIntro', { set: setCode, count: cardsCount })}
        {status.state === 'running' &&
          t('offline.setProgress', {
            done: status.progress.done + status.progress.failed,
            total: status.progress.total,
          })}
        {status.state === 'done' &&
          (status.progress.failed === 0
            ? t('offline.setDone', { set: setCode })
            : t('offline.setPartial', { count: status.progress.failed }))}
      </p>
      {status.state === 'running' ? (
        <progress
          className="h-2 w-32 accent-foreground"
          max={status.progress.total}
          value={status.progress.done + status.progress.failed}
          aria-label={t('offline.setProgressLabel')}
        />
      ) : (
        (status.state === 'idle' || status.progress.failed > 0) && (
          <button
            type="button"
            disabled={!online}
            title={online ? undefined : t('offline.needsConnection')}
            onClick={() => {
              void start()
            }}
            className="inline-flex h-9 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
          >
            {status.state === 'idle' ? t('offline.setDownload') : t('offline.retry')}
          </button>
        )
      )}
    </div>
  )
}
