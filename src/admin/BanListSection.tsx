import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useId, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { field } from '@/account/form-data'
import { FormMessage } from '@/account/form'
import { refreshBanList, useBanListEntries, type BanListEntry } from '@/catalog/ban-list'
import type { CatalogCard } from '@/catalog/catalog-data'
import { useCatalog } from '@/catalog/local-catalog'
import {
  deleteBanEntry,
  insertBanEntry,
  normalizeDraft,
  updateBanEntry,
  type BanDraft,
  type DraftProblem,
} from './ban-list-admin'

// Area Admin, sezione Ban List (RIB-29): aggiungere, modificare e rimuovere le voci. Il database
// accetta solo l'Admin attivo e registra ogni modifica nel registro delle azioni.

const KINDS: readonly BanListEntry['kind'][] = ['banned', 'restricted', 'pair']
const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50'
const INPUT = 'h-10 w-full rounded-xl border bg-background px-3 text-sm'

export function BanListSection() {
  const { t } = useTranslation()
  const entries = useBanListEntries()
  const { catalog } = useCatalog()
  const cards = catalog?.cards ?? []
  const [editing, setEditing] = useState<BanListEntry | 'new' | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const [failed, setFailed] = useState(false)
  const nameOf = (code: string | null) =>
    code ? `${code} · ${cards.find((c) => c.cardCode === code)?.name ?? '?'}` : ''

  const remove = (id: number) => {
    setFailed(false)
    void deleteBanEntry(id).then(
      () => {
        setConfirmDelete(null)
        void refreshBanList()
      },
      () => {
        setFailed(true)
      },
    )
  }

  const sorted = [...entries].sort(
    (a, b) =>
      b.effectiveFrom.localeCompare(a.effectiveFrom) || a.cardCode.localeCompare(b.cardCode),
  )

  return (
    <section className="space-y-4" aria-labelledby="ban-titolo">
      <div className="flex items-center gap-3">
        <h2 id="ban-titolo" className="text-lg font-semibold tracking-tight">
          {t('admin.ban.title')}
        </h2>
        {editing === null && (
          <button
            type="button"
            onClick={() => {
              setEditing('new')
            }}
            className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            {t('admin.ban.add')}
          </button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{t('admin.ban.intro')}</p>

      {editing !== null && (
        <BanForm
          key={editing === 'new' ? 'new' : editing.id}
          entry={editing === 'new' ? null : editing}
          cards={cards}
          onDone={() => {
            setEditing(null)
            void refreshBanList()
          }}
          onCancel={() => {
            setEditing(null)
          }}
        />
      )}
      {failed && <FormMessage tone="error">{t('admin.ban.saveFailed')}</FormMessage>}

      <ul className="divide-y rounded-2xl border">
        {sorted.map((e) => (
          <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
            <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">
              {t(`legality.badge.${e.kind}`)}
              {e.kind === 'restricted' && ` ${String(e.maxCopies ?? 0)}`}
            </span>
            <span className="min-w-0 flex-1">
              <span className="font-medium">{nameOf(e.cardCode)}</span>
              {e.pairCode && <span> + {nameOf(e.pairCode)}</span>}
              <span className="block text-xs text-muted-foreground">
                {t('admin.ban.from', { date: e.effectiveFrom })}
                {e.source && ` · ${e.source}`}
              </span>
            </span>
            {confirmDelete === e.id ? (
              <span
                className="flex gap-2"
                role="alertdialog"
                aria-label={t('admin.ban.deleteConfirm')}
              >
                <button
                  type="button"
                  onClick={() => {
                    remove(e.id)
                  }}
                  className="inline-flex h-9 items-center rounded-full bg-destructive px-3 text-xs font-medium text-white"
                >
                  {t('admin.ban.delete')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmDelete(null)
                  }}
                  className={BUTTON}
                >
                  {t('decks.cancel')}
                </button>
              </span>
            ) : (
              <span className="flex gap-2">
                <button
                  type="button"
                  aria-label={t('admin.ban.editOf', { code: e.cardCode })}
                  onClick={() => {
                    setEditing(e)
                  }}
                  className={BUTTON}
                >
                  <Pencil className="size-3.5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={t('admin.ban.deleteOf', { code: e.cardCode })}
                  onClick={() => {
                    setConfirmDelete(e.id)
                  }}
                  className={BUTTON}
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function BanForm({
  entry,
  cards,
  onDone,
  onCancel,
}: {
  entry: BanListEntry | null
  cards: readonly CatalogCard[]
  onDone: () => void
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const listId = useId()
  const [kind, setKind] = useState<BanListEntry['kind']>(entry?.kind ?? 'banned')
  const [problem, setProblem] = useState<DraftProblem | 'save' | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const max = field(form, 'max')
    const draft: BanDraft = {
      cardCode: field(form, 'card'),
      kind,
      maxCopies: max === '' ? null : Number(max),
      pairCode: field(form, 'pair') || null,
      effectiveFrom: field(form, 'from'),
      source: field(form, 'source'),
    }
    const normalized = normalizeDraft(draft)
    if (typeof normalized === 'string') {
      setProblem(normalized)
      return
    }
    setBusy(true)
    setProblem(null)
    const save = entry ? updateBanEntry(entry.id, normalized) : insertBanEntry(normalized)
    void save.then(onDone, () => {
      setBusy(false)
      setProblem('save')
    })
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border p-4" noValidate>
      {/* Suggerimenti: Card Code e nome dal catalogo. */}
      <datalist id={listId}>
        {cards.map((c) => (
          <option key={c.cardCode} value={c.cardCode}>
            {c.name}
          </option>
        ))}
      </datalist>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t('admin.ban.card')}</span>
          <input
            name="card"
            list={listId}
            defaultValue={entry?.cardCode ?? ''}
            autoCapitalize="characters"
            required
            className={INPUT}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t('admin.ban.kind')}</span>
          <select
            value={kind}
            onChange={(e) => {
              setKind(e.target.value as BanListEntry['kind'])
            }}
            className={INPUT}
          >
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`legality.badge.${k}`)}
              </option>
            ))}
          </select>
        </label>
        {kind === 'restricted' && (
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t('admin.ban.maxCopies')}</span>
            <input
              name="max"
              type="number"
              min={0}
              max={3}
              defaultValue={entry?.maxCopies ?? 1}
              className={INPUT}
            />
          </label>
        )}
        {kind === 'pair' && (
          <label className="space-y-1 text-sm">
            <span className="font-medium">{t('admin.ban.pairCard')}</span>
            <input
              name="pair"
              list={listId}
              defaultValue={entry?.pairCode ?? ''}
              autoCapitalize="characters"
              className={INPUT}
            />
          </label>
        )}
        <label className="space-y-1 text-sm">
          <span className="font-medium">{t('admin.ban.effectiveFrom')}</span>
          <input
            name="from"
            type="date"
            defaultValue={entry?.effectiveFrom ?? ''}
            required
            className={INPUT}
          />
        </label>
        <label className="space-y-1 text-sm sm:col-span-2">
          <span className="font-medium">{t('admin.ban.source')}</span>
          <input name="source" defaultValue={entry?.source ?? ''} className={INPUT} />
        </label>
      </div>
      {problem && <FormMessage tone="error">{t(`admin.ban.problem.${problem}`)}</FormMessage>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-10 items-center rounded-full bg-foreground px-4 text-sm font-medium text-background disabled:opacity-50"
        >
          {t('decks.save')}
        </button>
        <button type="button" onClick={onCancel} className={BUTTON}>
          {t('decks.cancel')}
        </button>
      </div>
    </form>
  )
}
