import { ArrowLeft, Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { RequireAccount } from '@/account/ProfilePage'
import { useSession } from '@/account/session'
import { SignedOutInvite } from '@/account/SignedOutInvite'
import { cardImageUrl } from '@/catalog/card-image'
import { useCatalog } from '@/catalog/local-catalog'
import { useCollection } from '@/collection/collection-store'
import { useDeck } from '@/decks/deck-store'
import { deckOwnership } from '@/decks/missing-cards'
import { DECKS_PATH, deckPath } from '@/decks/paths'
import { deckPrintRows, printablePrintings, printItems, type DeckPrintRow } from './deck-print'
import type { PrintColor } from './print-pdf'
import { PrintColorToggle, PrintPdfPanel } from './PrintPdfPanel'
import { SheetPreview } from './SheetPreview'

// Stampa delle carte del mazzo (RIB-80): si parte dalle mancanti, si cambiano copie e Printing,
// si vede l'anteprima dei fogli e si crea il PDF.

export function DeckPrintPage() {
  const { t } = useTranslation()
  const session = useSession()
  const { deckId = '' } = useParams()
  return session.status === 'signedOut' ? (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t('print.title')}</h1>
      <SignedOutInvite text={t('decks.signedOut')} returnTo={DECKS_PATH} />
    </div>
  ) : (
    <RequireAccount>{({ user }) => <DeckPrint deckId={deckId} userId={user.id} />}</RequireAccount>
  )
}

function DeckPrint({ deckId, userId }: { deckId: string; userId: string }) {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const { state } = useDeck(deckId)
  const { state: collection } = useCollection(userId)
  const byCode = useMemo(
    () => new Map((catalog?.cards ?? []).map((card) => [card.cardCode, card])),
    [catalog],
  )
  const initial = useMemo(() => {
    if (state.status !== 'ready' || collection.status !== 'ready' || !catalog) return null
    const ownership = deckOwnership(state.deck.leaderCode, state.cards, collection.entries)
    return deckPrintRows(state.deck, state.cards, ownership, byCode)
  }, [state, collection, catalog, byCode])
  // Le modifiche dell'utente; si riparte dai dati del mazzo solo la prima volta.
  const [rows, setRows] = useState<DeckPrintRow[] | null>(null)
  if (rows === null && initial !== null) setRows(initial)
  const [color, setColor] = useState<PrintColor>('color')

  if (state.status === 'missing' || state.status === 'error' || collection.status === 'error') {
    return (
      <div className="space-y-3">
        <p role="alert">{t(state.status === 'missing' ? 'decks.notFound' : 'decks.loadFailed')}</p>
        <Link to={DECKS_PATH} className="text-sm underline underline-offset-2">
          {t('decks.backToList')}
        </Link>
      </div>
    )
  }
  if (state.status !== 'ready' || rows === null) {
    return <p className="text-muted-foreground">{t('decks.loadingDeck')}</p>
  }

  const change = (cardCode: string, patch: Partial<DeckPrintRow>) => {
    setRows((current) =>
      (current ?? []).map((row) => (row.card.cardCode === cardCode ? { ...row, ...patch } : row)),
    )
  }
  const items = printItems(rows)
  const missing = rows.filter((row) => row.missing > 0)
  const others = rows.filter((row) => row.missing === 0)

  return (
    <div className="space-y-6">
      <Link
        to={deckPath(deckId)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {state.deck.name}
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight lg:text-3xl">{t('print.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('print.intro')}</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          {missing.length > 0 ? (
            <section aria-labelledby="stampa-mancanti" className="space-y-2">
              <h2 id="stampa-mancanti" className="text-sm font-semibold">
                {t('print.missing')}
              </h2>
              <PrintRows rows={missing} onChange={change} />
            </section>
          ) : (
            <p className="text-sm">{t('decks.missing.none')}</p>
          )}
          {others.length > 0 && (
            <details className="rounded-2xl border" open={missing.length === 0}>
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">
                {t('print.others', { count: others.length })}
              </summary>
              <div className="px-4 pb-3">
                <PrintRows rows={others} onChange={change} />
              </div>
            </details>
          )}
        </div>

        <div className="space-y-5 lg:sticky lg:top-4 lg:self-start">
          <PrintColorToggle color={color} onChange={setColor} />
          <PrintPdfPanel items={items} name={state.deck.name} color={color} />
          <SheetPreview items={items} color={color} />
        </div>
      </div>
    </div>
  )
}

function PrintRows({
  rows,
  onChange,
}: {
  rows: readonly DeckPrintRow[]
  onChange: (cardCode: string, patch: Partial<DeckPrintRow>) => void
}) {
  const { t } = useTranslation()
  return (
    <ul className="divide-y">
      {rows.map((row) => {
        const { card } = row
        const printable = printablePrintings(card)
        const shown = printable.find((p) => p.printId === row.printId)
        return (
          <li key={card.cardCode} className="flex items-center gap-3 py-2">
            {shown ? (
              <img
                src={cardImageUrl(shown, 'thumb')}
                crossOrigin="anonymous"
                alt=""
                width={300}
                height={419}
                loading="lazy"
                className="h-auto w-11 shrink-0 rounded-sm bg-muted"
              />
            ) : (
              <span className="block aspect-[300/419] w-11 shrink-0 rounded-sm bg-muted" />
            )}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="truncate text-sm font-medium">
                {card.name} <span className="text-xs text-muted-foreground">{card.cardCode}</span>
              </p>
              {row.printId === null ? (
                <p className="text-xs text-muted-foreground">{t('print.noImage')}</p>
              ) : printable.length > 1 ? (
                <select
                  aria-label={t('print.printing', { name: card.name })}
                  value={row.printId}
                  onChange={(e) => {
                    onChange(card.cardCode, { printId: e.target.value })
                  }}
                  className="h-8 max-w-full rounded-lg border bg-background px-2 text-xs"
                >
                  {printable.map((p) => (
                    <option key={p.printId} value={p.printId}>
                      {p.printId} · {p.setCode} · {p.rarity}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-muted-foreground">{row.printId}</p>
              )}
              {row.missing > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('print.missingOf', { missing: row.missing, required: row.required })}
                </p>
              )}
            </div>
            {row.printId !== null && (
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label={t('print.less', { name: card.name })}
                  disabled={row.copies === 0}
                  onClick={() => {
                    onChange(card.cardCode, { copies: row.copies - 1 })
                  }}
                  className="inline-flex size-9 items-center justify-center rounded-full border hover:bg-muted disabled:opacity-40"
                >
                  <Minus className="size-4" aria-hidden="true" />
                </button>
                <span
                  className="w-6 text-center text-sm font-semibold tabular-nums"
                  aria-label={t('print.copies', { count: row.copies })}
                >
                  {row.copies}
                </span>
                <button
                  type="button"
                  aria-label={t('print.more', { name: card.name })}
                  disabled={row.copies >= row.required}
                  onClick={() => {
                    onChange(card.cardCode, { copies: row.copies + 1 })
                  }}
                  className="inline-flex size-9 items-center justify-center rounded-full border hover:bg-muted disabled:opacity-40"
                >
                  <Plus className="size-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
