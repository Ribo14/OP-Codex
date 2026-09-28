import { Camera, Check, LoaderCircle, Minus, Plus, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { field } from '@/account/form-data'
import { useSession } from '@/account/session'
import { cardPath } from '@/catalog/card-links'
import type { CatalogCard, CatalogPrinting } from '@/catalog/catalog-data'
import { useCatalog } from '@/catalog/local-catalog'
import { useEuro } from '@/catalog/price-format'
import {
  copiesOf,
  DEFAULT_LANGUAGE,
  isLanguage,
  LANGUAGES,
  type Language,
} from '@/collection/collection'
import { useCollection } from '@/collection/collection-store'
import { CardThumb } from '@/decks/CardThumb'
import { cn } from '@/lib/utils'
import { useOnline } from '@/lib/use-online'
import { startOcr, type Ocr } from './ocr'
import { createConfirmer } from './scan-confirm'
import { cardFrame, codeZone, toVideo, type Rect } from './scan-geometry'
import { recognize } from './scan-recognizer'

// Scanner (fase 4, rifatto con RIB-68): si inquadra la carta e l'OCR legge di continuo il Card
// Code nell'angolo in basso a destra, senza pulsanti. Quando lo stesso codice del catalogo arriva
// in due letture di fila la lettura si ferma e la carta compare in un pannello sopra la
// fotocamera; "Non è questa" riprende la lettura. Tutto sul dispositivo: la foto non viene
// salvata né inviata. In fondo il testo letto, per le prove su carte reali (RIB-63).
// Burst Scan (modalità "Aggiungi alla collezione"): nel pannello si scelgono stampa e copie e un
// tocco le aggiunge alla Collection, poi si passa alla carta successiva.

type CameraState = 'idle' | 'starting' | 'ready' | 'denied' | 'unavailable'
const MODES = ['look', 'collect'] as const
type Mode = (typeof MODES)[number]

/** Pausa tra una lettura e l'altra: lascia respirare il telefono. */
const PAUSE_MS = 150

interface LastRead {
  text: string
  /** Codici letti che esistono nel catalogo, e quelli che non esistono. */
  found: string[]
  unknown: string[]
  ms: number
}

export function ScannerPage() {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const navigate = useNavigate()
  const session = useSession()
  const collector = session.status === 'signedIn' && !session.needsCode ? session.user.id : null
  const [modeChoice, setMode] = useState<Mode>('look')
  const mode: Mode = collector ? modeChoice : 'look'
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE)
  const [added, setAdded] = useState(0)
  const video = useRef<HTMLVideoElement>(null)
  const viewer = useRef<HTMLDivElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const ocr = useRef<Promise<Ocr> | null>(null)
  const confirmer = useRef(createConfirmer())
  const [camera, setCamera] = useState<CameraState>('idle')
  const [match, setMatch] = useState<string | null>(null)
  const [last, setLast] = useState<LastRead | null>(null)
  const [tally, setTally] = useState({ reads: 0, found: 0 })
  const [ocrFailed, setOcrFailed] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const byCode = useMemo(
    () => new Map((catalog?.cards ?? []).map((card) => [card.cardCode, card])),
    [catalog],
  )
  const codes = useMemo(() => new Set(byCode.keys()), [byCode])

  const start = useCallback(async () => {
    // Senza HTTPS (o su browser vecchi) mediaDevices non esiste proprio.
    if (!('mediaDevices' in navigator)) {
      setCamera('unavailable')
      return
    }
    setCamera('starting')
    // L'OCR si prepara mentre si apre la fotocamera.
    ocr.current ??= startOcr()
    ocr.current.catch(() => {
      setOcrFailed(true)
    })
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      })
      stream.current = media
      if (video.current) {
        video.current.srcObject = media
        await video.current.play()
      }
      setCamera('ready')
    } catch (error) {
      setCamera(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? 'denied'
          : 'unavailable',
      )
    }
  }, [])

  // Se il permesso della fotocamera c'è già, la fotocamera parte da sola aprendo la pagina.
  // Uscendo dalla pagina si spengono fotocamera e OCR.
  useEffect(() => {
    let active = true
    navigator.permissions
      .query({ name: 'camera' })
      .then((status) => {
        if (active && status.state === 'granted') void start()
      })
      .catch(() => undefined)
    return () => {
      active = false
      stream.current?.getTracks().forEach((track) => {
        track.stop()
      })
      void ocr.current?.then((o) => o.stop()).catch(() => undefined)
    }
  }, [start])

  // La lettura continua: un fotogramma dopo l'altro finché non c'è una carta confermata.
  useEffect(() => {
    if (camera !== 'ready' || match !== null || ocrFailed || catalog === null) return
    // Letto con una funzione: TypeScript non vede che la pulizia lo cambia durante gli await.
    const run = { stopped: false }
    const isStopped = () => run.stopped
    const loop = async () => {
      while (!isStopped()) {
        const el = video.current
        const worker = ocr.current
        if (!el || !worker) return
        if (document.hidden || el.videoWidth === 0) {
          await wait(PAUSE_MS * 3)
          continue
        }
        const box = { width: el.clientWidth, height: el.clientHeight }
        const zone: Rect = toVideo(codeZone(cardFrame(box)), box, {
          width: el.videoWidth,
          height: el.videoHeight,
        })
        const started = performance.now()
        let text: string
        try {
          text = await (await worker).read(el, zone)
        } catch {
          if (!isStopped()) setOcrFailed(true)
          return
        }
        if (isStopped()) return
        const result = recognize(text, codes)
        setLast({ text, ...result, ms: Math.round(performance.now() - started) })
        setTally((n) => ({
          reads: n.reads + 1,
          found: n.found + (result.found.length > 0 ? 1 : 0),
        }))
        const confirmed = confirmer.current.push(result.found)
        if (confirmed) {
          // iPhone non vibra: vibrate non esiste in Safari.
          if ('vibrate' in navigator) navigator.vibrate(60)
          setNotice(null)
          setMatch(confirmed)
          return
        }
        await wait(PAUSE_MS)
      }
    }
    void loop()
    return () => {
      run.stopped = true
    }
  }, [camera, match, ocrFailed, catalog, codes])

  /** Chiude il pannello e riprende la lettura, senza riproporre subito la stessa carta. */
  const resume = (message: string | null = null) => {
    if (match) confirmer.current.block(match)
    setNotice(message)
    setMatch(null)
  }

  // Trovata una carta, la fotocamera (con il pannello sopra) si porta tutta in vista.
  useEffect(() => {
    if (match) viewer.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [match])

  const card = match ? byCode.get(match) : undefined

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('scanner.title')}</h1>
        {/* Con la fotocamera accesa la pagina deve stare in uno schermo: niente introduzione. */}
        {camera !== 'ready' && (
          <p className="text-sm text-muted-foreground">{t('scanner.intro')}</p>
        )}
      </div>

      {collector && (
        <div className="space-y-2">
          <div
            role="group"
            aria-label={t('scanner.mode.label')}
            className="grid grid-cols-2 gap-1 rounded-full bg-muted p-1 text-sm font-medium"
          >
            {MODES.map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => {
                  setMode(m)
                }}
                className={cn(
                  'h-9 rounded-full px-3 transition-colors',
                  mode === m
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {t(`scanner.mode.${m}`)}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t(`scanner.mode.${mode}Hint`)}</p>
          {mode === 'collect' && (
            <div className="flex items-center justify-between gap-3 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('scanner.burst.language')}</span>
                <select
                  value={language}
                  onChange={(e) => {
                    if (isLanguage(e.target.value)) setLanguage(e.target.value)
                  }}
                  className="h-9 rounded-full border bg-background px-3 text-sm"
                >
                  {LANGUAGES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-muted-foreground" aria-live="polite">
                {t('scanner.burst.added', { count: added })}
              </p>
            </div>
          )}
        </div>
      )}

      <div
        ref={viewer}
        // scroll-mb: sul telefono la barra in basso copre il fondo della pagina.
        className="relative h-[58dvh] max-h-[640px] min-h-[340px] scroll-mt-4 scroll-mb-24 overflow-hidden rounded-3xl bg-black lg:scroll-mb-4"
      >
        <video
          ref={video}
          playsInline
          muted
          aria-label={t('scanner.preview')}
          className="absolute inset-0 size-full object-cover"
        />
        {camera === 'ready' ? (
          <FrameOverlay last={last} match={match} notice={notice} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
            {camera === 'idle' || camera === 'starting' ? (
              <>
                <Camera className="size-10 opacity-80" aria-hidden="true" />
                <p className="text-sm opacity-90">{t('scanner.permission')}</p>
                <button
                  type="button"
                  disabled={camera === 'starting'}
                  onClick={() => {
                    void start()
                  }}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-medium text-black disabled:opacity-60"
                >
                  {camera === 'starting' && (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                  )}
                  {t('scanner.start')}
                </button>
              </>
            ) : (
              <p role="alert" className="text-sm">
                {t(camera === 'denied' ? 'scanner.denied' : 'scanner.unavailable')}
              </p>
            )}
          </div>
        )}

        {card && (
          <div className="absolute inset-x-0 bottom-0 max-h-[85%] overflow-y-auto rounded-t-3xl bg-background p-4 shadow-2xl">
            {mode === 'collect' && collector ? (
              <CollectPanel
                key={card.cardCode}
                card={card}
                userId={collector}
                language={language}
                onAdded={(printId, copies) => {
                  setAdded((n) => n + copies)
                  resume(t('scanner.burst.done', { count: copies, printId }))
                }}
                onDismiss={() => {
                  resume()
                }}
              />
            ) : (
              <LookPanel
                card={card}
                onOpen={(printId) => {
                  void navigate(cardPath(card.cardCode, new URLSearchParams(), printId))
                }}
                onDismiss={() => {
                  resume()
                }}
              />
            )}
          </div>
        )}
      </div>

      {ocrFailed && (
        <p role="alert" className="text-sm text-destructive">
          {t('scanner.ocrFailed')}
        </p>
      )}

      <ManualCode
        codes={codes}
        ready={catalog !== null}
        // Nella modalità collezione il codice scritto a mano apre il pannello, senza cambiare pagina.
        onFound={
          mode === 'collect'
            ? (code) => {
                setMatch(code)
              }
            : null
        }
      />

      {last && (
        <details className="rounded-2xl border p-4 text-sm">
          <summary className="cursor-pointer font-medium">{t('scanner.test.title')}</summary>
          <p className="mt-2 text-muted-foreground">
            {t('scanner.test.tally', { found: tally.found, reads: tally.reads, ms: last.ms })}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs whitespace-pre-wrap">
            {last.text.trim() || '—'}
          </pre>
        </details>
      )}
    </div>
  )
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Il riquadro della carta, con la zona del codice evidenziata e lo stato della lettura. */
function FrameOverlay({
  last,
  match,
  notice,
}: {
  last: LastRead | null
  match: string | null
  notice: string | null
}) {
  const { t } = useTranslation()
  const [found] = last?.found ?? []
  const [unknown] = last?.unknown ?? []
  const status = match
    ? t('scanner.status.found', { code: match })
    : (notice ??
      (found
        ? t('scanner.status.hold', { code: found })
        : unknown
          ? t('scanner.status.unknown', { code: unknown })
          : t('scanner.status.searching')))
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = box.current
    if (!el) return
    const observer = new ResizeObserver(() => {
      setSize({ width: el.clientWidth, height: el.clientHeight })
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
    }
  }, [])
  const frame = cardFrame(size)
  const zone = codeZone(frame)
  const px = (r: Rect) => ({
    left: r.x,
    top: r.y,
    width: r.width,
    height: r.height,
  })
  return (
    <div ref={box} className="pointer-events-none absolute inset-0">
      <div
        className="absolute rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]"
        style={px(frame)}
      />
      <div className="absolute rounded-md border-2 border-amber-400" style={px(zone)} />
      <div className="absolute inset-x-3 top-3 space-y-1 text-center text-white drop-shadow">
        <p className="text-xs font-medium">{t('scanner.aim')}</p>
        <p className="text-xs opacity-80">{t('scanner.glare')}</p>
      </div>
      <p
        aria-live="polite"
        className="absolute inset-x-6 bottom-4 rounded-full bg-black/60 px-3 py-1.5 text-center text-xs font-medium text-white"
      >
        {status}
      </p>
    </div>
  )
}

function PanelHeader({ card, onDismiss }: { card: CatalogCard; onDismiss: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {card.cardCode}
        </p>
        <h2 className="truncate text-lg font-semibold">{card.name}</h2>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium hover:bg-muted"
      >
        <X className="size-4" aria-hidden="true" />
        {t('scanner.notThis')}
      </button>
    </div>
  )
}

/** Consultazione: si tocca la stampa giusta e se ne apre il dettaglio. Sotto ognuna il prezzo. */
function LookPanel({
  card,
  onOpen,
  onDismiss,
}: {
  card: CatalogCard
  onOpen: (printId: string) => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  return (
    <section aria-label={card.name} className="space-y-3">
      <PanelHeader card={card} onDismiss={onDismiss} />
      <p className="text-sm text-muted-foreground">
        {card.printings.length > 1 ? t('scanner.choose') : t('scanner.open')}
      </p>
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {card.printings.map((printing) => (
          <li key={printing.printId} className="w-24 shrink-0">
            <button
              type="button"
              onClick={() => {
                onOpen(printing.printId)
              }}
              aria-label={t('scanner.openPrinting', {
                printId: printing.printId,
                rarity: printing.rarity,
              })}
              className="w-full space-y-1 rounded-lg text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <CardThumb printing={printing} name={card.name} className="w-full" />
              <PrintingCaption printing={printing} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Burst Scan: stampa e numero di copie scelti al volo, un tocco per aggiungerle. */
function CollectPanel({
  card,
  userId,
  language,
  onAdded,
  onDismiss,
}: {
  card: CatalogCard
  userId: string
  language: Language
  onAdded: (printId: string, copies: number) => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  const online = useOnline()
  const { state, change } = useCollection(userId)
  const [printId, setPrintId] = useState(card.printings[0]?.printId ?? '')
  const [copies, setCopies] = useState(1)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const ready = state.status === 'ready'
  const add = () => {
    setFailed(false)
    setSaving(true)
    void change(printId, language, copies).then((saved) => {
      setSaving(false)
      if (saved) onAdded(printId, copies)
      else setFailed(true)
    })
  }
  return (
    <section aria-label={card.name} className="space-y-3">
      <PanelHeader card={card} onDismiss={onDismiss} />
      {card.printings.length > 1 && (
        <p className="text-sm text-muted-foreground">{t('scanner.burst.choose')}</p>
      )}
      <ul className="flex gap-3 overflow-x-auto pb-1">
        {card.printings.map((printing) => {
          const selected = printing.printId === printId
          const owned = ready ? copiesOf(state.entries, printing.printId).total : 0
          return (
            <li key={printing.printId} className="w-24 shrink-0">
              <button
                type="button"
                aria-pressed={selected}
                aria-label={t('scanner.burst.pick', {
                  printId: printing.printId,
                  rarity: printing.rarity,
                  count: owned,
                })}
                onClick={() => {
                  setPrintId(printing.printId)
                }}
                className={cn(
                  'relative w-full space-y-1 rounded-lg p-1 text-left ring-2 focus-visible:outline-none',
                  selected ? 'ring-foreground' : 'ring-transparent',
                )}
              >
                <CardThumb printing={printing} name={card.name} className="w-full" />
                {selected && (
                  <span className="absolute top-2 right-2 rounded-full bg-foreground p-0.5 text-background">
                    <Check className="size-3.5" aria-hidden="true" />
                  </span>
                )}
                <PrintingCaption printing={printing} />
                <span className="block text-xs text-muted-foreground">
                  {t('scanner.burst.owned', { count: owned })}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <div className="flex items-center gap-3">
        <div
          role="group"
          aria-label={t('scanner.burst.copies')}
          className="flex h-11 items-center rounded-full border"
        >
          <button
            type="button"
            disabled={copies <= 1}
            onClick={() => {
              setCopies((n) => Math.max(1, n - 1))
            }}
            aria-label={t('scanner.burst.less')}
            className="grid size-11 place-items-center rounded-full disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <output aria-live="polite" className="w-6 text-center font-semibold tabular-nums">
            {copies}
          </output>
          <button
            type="button"
            disabled={copies >= 99}
            onClick={() => {
              setCopies((n) => Math.min(99, n + 1))
            }}
            aria-label={t('scanner.burst.more')}
            className="grid size-11 place-items-center rounded-full disabled:opacity-40"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        <button
          type="button"
          disabled={!online || !ready || saving || !printId}
          onClick={add}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background disabled:opacity-50"
        >
          {saving ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Plus className="size-4" aria-hidden="true" />
          )}
          {t('scanner.burst.add', { count: copies, language })}
        </button>
      </div>
      {!online && <p className="text-xs text-muted-foreground">{t('scanner.burst.offline')}</p>}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t('scanner.burst.failed')}
        </p>
      )}
    </section>
  )
}

function PrintingCaption({ printing }: { printing: CatalogPrinting }) {
  const euro = useEuro()
  const trend = printing.price?.trend ?? null
  return (
    <span className="block text-xs text-muted-foreground">
      <span className="block truncate">
        {printing.printId} · {printing.rarity}
      </span>
      {trend !== null && (
        <span className="block font-medium text-foreground tabular-nums">{euro(trend)}</span>
      )}
    </span>
  )
}

/** Correzione a mano: si scrive il Card Code (anche con gli stessi errori dell'OCR). */
function ManualCode({
  codes,
  ready,
  onFound,
}: {
  codes: ReadonlySet<string>
  ready: boolean
  /** Cosa fare con un codice valido; null = aprire il dettaglio della carta. */
  onFound: ((code: string) => void) | null
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error, setError] = useState(false)
  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!ready) return
    const form = event.currentTarget
    const text = field(new FormData(form), 'code')
    const [code] = recognize(text, codes).found
    setError(!code)
    if (!code) return
    if (onFound) {
      onFound(code)
      form.reset()
    } else void navigate(cardPath(code, new URLSearchParams()))
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="codice-manuale" className="text-sm font-medium">
        {t('scanner.manual.label')}
      </label>
      <div className="flex gap-2">
        <input
          id="codice-manuale"
          name="code"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder={t('scanner.manual.placeholder')}
          aria-invalid={error}
          aria-describedby={error ? 'codice-manuale-errore' : undefined}
          className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-base uppercase"
        />
        {/* Finché il catalogo non è caricato nessun codice risulterebbe esistente. */}
        <button
          type="submit"
          disabled={!ready}
          className="inline-flex h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
        >
          {t('scanner.manual.submit')}
        </button>
      </div>
      {error && (
        <p id="codice-manuale-errore" role="alert" className="text-sm text-destructive">
          {t('scanner.manual.notFound')}
        </p>
      )}
    </form>
  )
}
