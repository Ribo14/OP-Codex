import { ArrowLeft, Camera, LoaderCircle, Plus, ScanLine } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
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
import { useOnline } from '@/lib/use-online'
import { startOcr, type Ocr } from './ocr'
import { cardFrame, codeZone, toVideo, type Rect } from './scan-geometry'
import { recognize, type Recognition } from './scan-recognizer'

// Scanner (fase 4): si inquadra la carta, si tocca "Leggi il codice" e l'OCR legge il Card Code
// nell'angolo in basso a destra; se la Card ha più Printing si sceglie quella giusta.
// Tutto sul dispositivo: la foto non viene salvata né inviata. Il testo letto resta visibile
// in fondo per la prova su carte reali (slice 4.2).
// Burst Scan (slice 4.4): con "Aggiungi alla collezione" la carta letta non si apre, si
// aggiunge una copia della stampa giusta e si passa subito alla successiva.

type CameraState = 'idle' | 'starting' | 'ready' | 'denied' | 'unavailable'

interface Reading {
  text: string
  result: Recognition
  ms: number
}

/** Burst Scan attivo: di chi è la Collection, in che lingua si aggiunge, cosa fare dopo. */
interface Burst {
  userId: string
  language: Language
  onAdded: () => void
}

export function ScannerPage() {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const session = useSession()
  const collector = session.status === 'signedIn' && !session.needsCode ? session.user.id : null
  const [burstOn, setBurstOn] = useState(false)
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE)
  const [added, setAdded] = useState(0)
  const burst: Burst | null =
    burstOn && collector
      ? {
          userId: collector,
          language,
          onAdded: () => {
            setAdded((n) => n + 1)
          },
        }
      : null
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const ocr = useRef<Promise<Ocr> | null>(null)
  const [camera, setCamera] = useState<CameraState>('idle')
  const [reading, setReading] = useState(false)
  const [last, setLast] = useState<Reading | null>(null)
  const [tally, setTally] = useState({ reads: 0, found: 0 })
  const [ocrFailed, setOcrFailed] = useState(false)

  const byCode = useMemo(
    () => new Map((catalog?.cards ?? []).map((card) => [card.cardCode, card])),
    [catalog],
  )
  const codes = useMemo(() => new Set(byCode.keys()), [byCode])

  // Uscendo dalla pagina si spengono fotocamera e OCR.
  useEffect(
    () => () => {
      stream.current?.getTracks().forEach((track) => {
        track.stop()
      })
      void ocr.current?.then((o) => o.stop()).catch(() => undefined)
    },
    [],
  )

  const start = async () => {
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
  }

  const read = async () => {
    const el = video.current
    if (!el || !ocr.current || reading) return
    setReading(true)
    try {
      const box = { width: el.clientWidth, height: el.clientHeight }
      const zone: Rect = toVideo(codeZone(cardFrame(box)), box, {
        width: el.videoWidth,
        height: el.videoHeight,
      })
      const started = performance.now()
      const text = await (await ocr.current).read(el, zone)
      const result = recognize(text, codes)
      setLast({ text, result, ms: Math.round(performance.now() - started) })
      setTally((n) => ({ reads: n.reads + 1, found: n.found + (result.found.length > 0 ? 1 : 0) }))
    } catch {
      setOcrFailed(true)
    } finally {
      setReading(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('nav.catalog')}
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('scanner.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('scanner.intro')}</p>
      </div>

      <div className="relative aspect-[3/4] overflow-hidden rounded-3xl bg-black">
        <video
          ref={video}
          playsInline
          muted
          aria-label={t('scanner.preview')}
          className="absolute inset-0 size-full object-cover"
        />
        {camera === 'ready' ? (
          <FrameOverlay />
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
      </div>

      {collector && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border p-4 text-sm">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              role="switch"
              checked={burstOn}
              onChange={(e) => {
                setBurstOn(e.target.checked)
              }}
              className="size-4 accent-foreground"
            />
            {t('scanner.burst.toggle')}
          </label>
          {burstOn && (
            <>
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
              <p className="w-full text-muted-foreground" aria-live="polite">
                {t('scanner.burst.added', { count: added })}
              </p>
            </>
          )}
        </div>
      )}

      {camera === 'ready' && (
        <button
          type="button"
          disabled={reading || ocrFailed || catalog === null}
          onClick={() => {
            void read()
          }}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-medium text-background disabled:opacity-60"
        >
          {reading ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <ScanLine className="size-4" aria-hidden="true" />
          )}
          {reading ? t('scanner.reading') : t('scanner.read')}
        </button>
      )}
      {ocrFailed && (
        <p role="alert" className="text-sm text-destructive">
          {t('scanner.ocrFailed')}
        </p>
      )}

      <div aria-live="polite" className="space-y-4">
        {last && <ReadingResult reading={last} byCode={byCode} burst={burst} />}
      </div>

      <ManualCode
        codes={codes}
        ready={catalog !== null}
        // Nel Burst Scan il codice scritto a mano si comporta come una lettura: niente cambio pagina.
        onFound={
          burst
            ? (text) => {
                setLast({ text, result: recognize(text, codes), ms: 0 })
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

/** Il riquadro della carta, con la zona del codice evidenziata. */
function FrameOverlay() {
  const { t } = useTranslation()
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
      <p className="absolute inset-x-0 top-3 text-center text-xs font-medium text-white drop-shadow">
        {t('scanner.aim')}
      </p>
    </div>
  )
}

function ReadingResult({
  reading,
  byCode,
  burst,
}: {
  reading: Reading
  byCode: ReadonlyMap<string, CatalogCard>
  burst: Burst | null
}) {
  const { t } = useTranslation()
  const { found, unknown } = reading.result
  if (found.length === 0) {
    return (
      <p className="rounded-2xl bg-muted p-4 text-sm">
        {unknown.length > 0
          ? t('scanner.unknown', { codes: unknown.join(', ') })
          : t('scanner.nothing')}
      </p>
    )
  }
  return (
    <>
      {found.map((code) => {
        const card = byCode.get(code)
        return card ? <FoundCard key={code} card={card} burst={burst} /> : null
      })}
    </>
  )
}

/**
 * La Card letta: si sceglie la Printing giusta. Normalmente se ne apre il dettaglio; nel Burst Scan
 * se ne aggiunge una copia alla Collection. Sotto ogni stampa il prezzo (user story 58).
 */
function FoundCard({ card, burst }: { card: CatalogCard; burst: Burst | null }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const open = (printId: string) => {
    void navigate(cardPath(card.cardCode, new URLSearchParams(), printId))
  }
  const hint = burst
    ? t('scanner.burst.choose')
    : card.printings.length > 1
      ? t('scanner.choose')
      : t('scanner.open')
  return (
    <section aria-label={card.name} className="space-y-3 rounded-2xl border p-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {card.cardCode}
        </p>
        <h2 className="text-lg font-semibold">{card.name}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {card.printings.map((printing) => (
          <li key={printing.printId} className="space-y-1">
            {burst ? (
              <>
                <CardThumb printing={printing} name={card.name} className="w-full" />
                <PrintingCaption printing={printing} />
                <AddCopy printing={printing} name={card.name} burst={burst} />
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  open(printing.printId)
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
            )}
          </li>
        ))}
      </ul>
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

/** Burst Scan: +1 copia della stampa nella lingua scelta, con le copie già possedute. */
function AddCopy({
  printing,
  name,
  burst,
}: {
  printing: CatalogPrinting
  name: string
  burst: Burst
}) {
  const { t } = useTranslation()
  const online = useOnline()
  const { state, change } = useCollection(burst.userId)
  const [failed, setFailed] = useState(false)
  const owned = state.status === 'ready' ? copiesOf(state.entries, printing.printId).total : 0
  const add = () => {
    setFailed(false)
    void change(printing.printId, burst.language, 1).then((saved) => {
      if (saved) burst.onAdded()
      else setFailed(true)
    })
  }
  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={!online || state.status !== 'ready'}
        onClick={add}
        aria-label={t('scanner.burst.add', { printId: printing.printId, name })}
        className="inline-flex h-9 w-full items-center justify-center gap-1 rounded-full bg-foreground text-xs font-medium text-background disabled:opacity-50"
      >
        <Plus className="size-3.5" aria-hidden="true" />
        {t('scanner.burst.owned', { count: owned })}
      </button>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t('scanner.burst.failed')}
        </p>
      )}
    </div>
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
  onFound: ((text: string) => void) | null
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
