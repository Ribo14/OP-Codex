import { ArrowLeft, Minus, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { RequireAccount } from '@/account/ProfilePage'
import { useSession } from '@/account/session'
import { SignedOutInvite } from '@/account/SignedOutInvite'
import type { Catalog } from '@/catalog/catalog-data'
import { useCatalog } from '@/catalog/local-catalog'
import type { ListError } from '@/decks/deck-list'
import { getSupabase } from '@/lib/supabase'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'
import { listRows, MAX_PER_ROW, payload, setRows as rowsOfSet, type BulkRow } from './bulk-add'
import { DEFAULT_LANGUAGE, isLanguage, LANGUAGES, type Language } from './collection'
import { useCollection } from './collection-store'
import { BULK_ADD_PATH, COLLECTION_PATH } from './paths'

// Aggiunta in blocco alla Collection (suggerimento dell'utente): tutte le carte di un Set, per
// esempio uno Starter Deck comprato, oppure una lista "4xST01-001" (le quantità degli Starter Deck
// non sono sul sito Bandai: le liste si trovano ovunque). Prima si vede e si corregge, poi si
// aggiunge tutto insieme con aggiungi_copie.

const MODES = ['set', 'list'] as const
type Mode = (typeof MODES)[number]

export function BulkAddPage() {
  const { t } = useTranslation()
  const session = useSession()
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        to={COLLECTION_PATH}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t('nav.collection')}
      </Link>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{t('collection.bulk.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('collection.bulk.intro')}</p>
      </div>
      {session.status === 'signedOut' ? (
        <SignedOutInvite text={t('collection.signedOut')} returnTo={BULK_ADD_PATH} />
      ) : (
        <RequireAccount>{({ user }) => <BulkAdd userId={user.id} />}</RequireAccount>
      )}
    </div>
  )
}

function BulkAdd({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const { reload } = useCollection(userId)
  const online = useOnline()
  const [mode, setMode] = useState<Mode>('set')
  const [rows, setRows] = useState<BulkRow[]>([])
  const [errors, setErrors] = useState<ListError[]>([])
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState<{ added: number } | 'failed' | null>(null)

  if (!catalog) return <p className="text-muted-foreground">{t('catalog.loading')}</p>

  const total = rows.reduce((sum, r) => sum + Math.min(r.quantity, MAX_PER_ROW), 0)
  const change = (printId: string, quantity: number) => {
    setRows((current) =>
      current.map((r) =>
        r.printId === printId
          ? { ...r, quantity: Math.max(0, Math.min(MAX_PER_ROW, quantity)) }
          : r,
      ),
    )
  }
  const show = (next: BulkRow[], nextErrors: ListError[] = []) => {
    setRows(next)
    setErrors(nextErrors)
    setResult(null)
  }

  const save = async () => {
    setSaving(true)
    setResult(null)
    const { data, error } = await getSupabase().rpc('aggiungi_copie', {
      p_righe: payload(rows, language),
    })
    setSaving(false)
    if (error) {
      setResult('failed')
      return
    }
    setResult({ added: data })
    setRows([])
    void reload()
  }

  return (
    <div className="space-y-5">
      <div role="tablist" className="flex rounded-full bg-muted p-1 text-sm sm:max-w-md">
        {MODES.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            onClick={() => {
              setMode(key)
              show([])
            }}
            className={cn(
              'flex-1 rounded-full px-3 py-2 font-medium',
              mode === key ? 'bg-background shadow-sm' : 'text-muted-foreground',
            )}
          >
            {t(`collection.bulk.mode.${key}`)}
          </button>
        ))}
      </div>

      {mode === 'set' ? (
        <SetPicker
          catalog={catalog}
          onPick={(setCode) => {
            show(setCode ? rowsOfSet(catalog.cards, setCode) : [])
          }}
        />
      ) : (
        <ListInput
          onRead={(text) => {
            const read = listRows(text, new Map(catalog.cards.map((c) => [c.cardCode, c])))
            show(read.rows, read.errors)
          }}
        />
      )}

      {errors.length > 0 && (
        <div
          role="alert"
          className="space-y-1 rounded-2xl border border-destructive/40 p-4 text-sm"
        >
          <p className="font-medium">{t('collection.bulk.errors', { count: errors.length })}</p>
          <ul className="list-disc pl-5 text-muted-foreground">
            {errors.map((e) => (
              <li key={e.line}>
                {t('collection.bulk.errorLine', { line: e.line, text: e.text })}{' '}
                {t(`collection.bulk.problem.${e.problem === 'unknown' ? 'unknown' : 'format'}`)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <section aria-label={t('collection.bulk.preview')} className="space-y-3">
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('collection.bulk.language')}</span>
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
          <ul className="divide-y rounded-2xl border">
            {rows.map((row) => (
              <li key={row.printId} className="flex items-center gap-3 px-4 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{row.name}</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {row.printId} · {row.rarity}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={row.quantity === 0}
                    onClick={() => {
                      change(row.printId, row.quantity - 1)
                    }}
                    aria-label={t('collection.bulk.less', { printId: row.printId })}
                    className="inline-flex size-9 items-center justify-center rounded-full border hover:bg-muted disabled:opacity-40"
                  >
                    <Minus className="size-4" aria-hidden="true" />
                  </button>
                  <output
                    aria-label={t('collection.bulk.copies', { printId: row.printId })}
                    className="w-6 text-center font-semibold tabular-nums"
                  >
                    {row.quantity}
                  </output>
                  <button
                    type="button"
                    disabled={row.quantity >= MAX_PER_ROW}
                    onClick={() => {
                      change(row.printId, row.quantity + 1)
                    }}
                    aria-label={t('collection.bulk.more', { printId: row.printId })}
                    className="inline-flex size-9 items-center justify-center rounded-full bg-foreground text-background disabled:opacity-40"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={total === 0 || saving || !online}
            onClick={() => void save()}
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-foreground text-sm font-medium text-background disabled:opacity-50 sm:w-auto sm:px-6"
          >
            {t('collection.bulk.add', { count: total, language })}
          </button>
          {!online && <p className="text-sm text-muted-foreground">{t('decks.offline')}</p>}
        </section>
      )}

      <div aria-live="polite">
        {result === 'failed' && (
          <p role="alert" className="text-sm text-destructive">
            {t('collection.bulk.failed')}
          </p>
        )}
        {result !== null && result !== 'failed' && (
          <p className="text-sm">
            {t('collection.bulk.done', { count: result.added })}{' '}
            <Link to={COLLECTION_PATH} className="font-medium underline underline-offset-2">
              {t('collection.bulk.toCollection')}
            </Link>
          </p>
        )}
      </div>
    </div>
  )
}

function SetPicker({ catalog, onPick }: { catalog: Catalog; onPick: (setCode: string) => void }) {
  const { t } = useTranslation()
  // Prima gli Starter Deck (il caso più comune: un mazzo comprato intero), poi gli altri.
  const sets = useMemo(
    () =>
      [...catalog.sets].sort(
        (a, b) =>
          Number(!a.code.startsWith('ST')) - Number(!b.code.startsWith('ST')) ||
          a.code.localeCompare(b.code, 'en', { numeric: true }),
      ),
    [catalog],
  )
  return (
    <div className="space-y-1 text-sm">
      <label htmlFor="set-collezione" className="block font-medium">
        {t('collection.bulk.set')}
      </label>
      <select
        id="set-collezione"
        aria-describedby="set-collezione-aiuto"
        defaultValue=""
        onChange={(e) => {
          onPick(e.target.value)
        }}
        className="h-11 w-full rounded-full border bg-background px-4 text-base sm:max-w-md"
      >
        <option value="">{t('collection.bulk.choose')}</option>
        {sets.map((s) => (
          <option key={s.seriesId} value={s.code}>
            {s.code} · {s.name}
          </option>
        ))}
      </select>
      <p id="set-collezione-aiuto" className="text-xs text-muted-foreground">
        {t('collection.bulk.setHint')}
      </p>
    </div>
  )
}

function ListInput({ onRead }: { onRead: (text: string) => void }) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  return (
    <div className="space-y-2">
      <label htmlFor="lista-collezione" className="block text-sm font-medium">
        {t('collection.bulk.list')}
      </label>
      <textarea
        id="lista-collezione"
        value={text}
        onChange={(e) => {
          setText(e.target.value)
        }}
        rows={8}
        spellCheck={false}
        placeholder={t('collection.bulk.listPlaceholder')}
        className="w-full rounded-2xl border bg-background p-3 font-mono text-sm"
      />
      <button
        type="button"
        disabled={text.trim() === ''}
        onClick={() => {
          onRead(text)
        }}
        className="inline-flex h-10 items-center rounded-full border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50"
      >
        {t('collection.bulk.read')}
      </button>
    </div>
  )
}
