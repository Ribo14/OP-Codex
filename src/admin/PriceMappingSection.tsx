import { RefreshCw, Search } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type SubmitEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { FormMessage } from '@/account/form'
import { field } from '@/account/form-data'
import type { CatalogCard } from '@/catalog/catalog-data'
import { useCatalog } from '@/catalog/local-catalog'
import { useEuro } from '@/catalog/price-format'
import { cn } from '@/lib/utils'
import {
  choiceOf,
  fetchMappings,
  fetchOverrides,
  fetchProducts,
  mappingQueue,
  printingStatus,
  saveChoice,
  type Choice,
  type MappingRow,
  type OverrideRow,
  type PrintingStatus,
  type ProductRow,
} from './price-mapping-admin'

// Area Admin, abbinamenti dei prezzi Cardmarket (RIB-32, slice 5.2). In alto le carte da
// controllare, sotto l'editor di una carta: per ogni Printing il prodotto Cardmarket da usare.

const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50'
/** Voci mostrate per elenco: le altre si aprono cercando il Card Code. */
const QUEUE_LIMIT = 40
const LISTS = ['check', 'missing'] as const
const AUTO: Choice = 'auto'
const NONE: Choice = 'none'

const STATUS_STYLE: Record<PrintingStatus, string> = {
  ok: 'bg-muted text-foreground',
  override: 'bg-muted text-foreground',
  check: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
  missing: 'bg-destructive/10 text-destructive',
  excluded: 'bg-muted text-muted-foreground',
}

interface Data {
  mappings: Map<string, MappingRow>
  overrides: Map<string, OverrideRow>
}

export function PriceMappingSection() {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const [data, setData] = useState<Data | null>(null)
  const [failed, setFailed] = useState(false)
  const [list, setList] = useState<'check' | 'missing'>('check')
  const [open, setOpen] = useState<string | null>(null)

  const read = useCallback(async (): Promise<Data | null> => {
    try {
      const [mappings, overrides] = await Promise.all([fetchMappings(), fetchOverrides()])
      return { mappings, overrides }
    } catch {
      return null
    }
  }, [])

  const show = useCallback((loaded: Data | null) => {
    setFailed(loaded === null)
    setData(loaded)
  }, [])

  useEffect(() => {
    let current = true
    void read().then((loaded) => {
      if (current) show(loaded)
    })
    return () => {
      current = false
    }
  }, [read, show])

  const printings = useMemo(
    () =>
      (catalog?.cards ?? []).flatMap((card) =>
        card.printings.map((p) => ({ printId: p.printId, cardCode: card.cardCode })),
      ),
    [catalog],
  )
  const byCode = useMemo(
    () => new Map((catalog?.cards ?? []).map((card) => [card.cardCode, card])),
    [catalog],
  )
  const queues = useMemo(
    () =>
      data
        ? {
            check: mappingQueue(printings, data.mappings, data.overrides, 'check'),
            missing: mappingQueue(printings, data.mappings, data.overrides, 'missing'),
          }
        : null,
    [data, printings],
  )

  const search = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const code = field(new FormData(event.currentTarget), 'code').trim().toUpperCase()
    setOpen(byCode.has(code) ? code : null)
  }
  const openCard = open ? byCode.get(open) : undefined

  return (
    <section className="space-y-4" aria-labelledby="abbinamenti-titolo">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="abbinamenti-titolo" className="text-lg font-semibold tracking-tight">
          {t('admin.prices.title')}
        </h2>
        <button
          type="button"
          onClick={() => {
            setData(null)
            void read().then(show)
          }}
          className={cn(BUTTON, 'ml-auto')}
        >
          <RefreshCw className="size-3.5" aria-hidden="true" />
          {t('admin.jobs.reload')}
        </button>
      </div>
      <p className="text-sm text-muted-foreground">{t('admin.prices.intro')}</p>
      {failed && <FormMessage tone="error">{t('account.problem.generic')}</FormMessage>}

      {queues === null ? (
        !failed && <p className="text-muted-foreground">{t('account.loading')}</p>
      ) : (
        <div className="space-y-3">
          <div role="tablist" className="flex rounded-full bg-muted p-1 text-sm sm:max-w-md">
            {LISTS.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={list === key}
                onClick={() => {
                  setList(key)
                }}
                className={cn(
                  'flex-1 rounded-full px-3 py-1.5 font-medium',
                  list === key ? 'bg-background shadow-sm' : 'text-muted-foreground',
                )}
              >
                {t(`admin.prices.list.${key}`, {
                  count: queues[key].reduce((sum, entry) => sum + entry.count, 0),
                })}
              </button>
            ))}
          </div>
          {queues[list].length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('admin.prices.empty')}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {queues[list].slice(0, QUEUE_LIMIT).map((entry) => (
                <li key={entry.cardCode}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(entry.cardCode)
                    }}
                    className={cn(BUTTON, open === entry.cardCode && 'bg-muted')}
                  >
                    {entry.cardCode} · {byCode.get(entry.cardCode)?.name ?? ''}
                    <span className="text-muted-foreground">×{entry.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {queues[list].length > QUEUE_LIMIT && (
            <p className="text-xs text-muted-foreground">
              {t('admin.prices.more', { count: queues[list].length - QUEUE_LIMIT })}
            </p>
          )}
        </div>
      )}

      <form onSubmit={search} className="flex gap-2 sm:max-w-md">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-full bg-muted px-4 text-sm">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="sr-only">{t('admin.prices.code')}</span>
          <input
            name="code"
            placeholder={t('admin.prices.code')}
            autoComplete="off"
            className="w-full min-w-0 bg-transparent text-base uppercase outline-none placeholder:text-muted-foreground placeholder:normal-case"
          />
        </label>
        <button type="submit" className={BUTTON}>
          {t('admin.prices.open')}
        </button>
      </form>

      {openCard && data && (
        <CardMapping
          key={openCard.cardCode}
          card={openCard}
          data={data}
          onSaved={(printId, override) => {
            const overrides = new Map(data.overrides)
            if (override) overrides.set(printId, override)
            else overrides.delete(printId)
            setData({ ...data, overrides })
          }}
        />
      )}
    </section>
  )
}

function CardMapping({
  card,
  data,
  onSaved,
}: {
  card: CatalogCard
  data: Data
  onSaved: (printId: string, override: OverrideRow | null) => void
}) {
  const { t } = useTranslation()
  const euro = useEuro()
  const [products, setProducts] = useState<ProductRow[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let current = true
    fetchProducts(card.cardCode).then(
      (rows) => {
        if (current) setProducts(rows)
      },
      () => {
        if (current) setFailed(true)
      },
    )
    return () => {
      current = false
    }
  }, [card.cardCode])

  const label = (p: ProductRow) =>
    t('admin.prices.product', {
      id: p.id_product,
      expansion: p.id_expansion,
      trend: p.trend === null ? '–' : euro(p.trend),
      low: p.low === null ? '–' : euro(p.low),
    })

  return (
    <div className="space-y-3 rounded-2xl border p-4">
      <h3 className="font-medium">
        {card.cardCode} · {card.name}
      </h3>
      {failed && <FormMessage tone="error">{t('account.problem.generic')}</FormMessage>}
      {products === null ? (
        !failed && <p className="text-sm text-muted-foreground">{t('account.loading')}</p>
      ) : (
        <>
          {products.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('admin.prices.noProducts')}</p>
          )}
          <ul className="divide-y">
            {card.printings.map((printing) => (
              <PrintingMapping
                key={printing.printId}
                printId={printing.printId}
                rarity={printing.rarity}
                mapping={data.mappings.get(printing.printId)}
                override={data.overrides.get(printing.printId)}
                products={products}
                label={label}
                onSaved={onSaved}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

function PrintingMapping({
  printId,
  rarity,
  mapping,
  override,
  products,
  label,
  onSaved,
}: {
  printId: string
  rarity: string
  mapping: MappingRow | undefined
  override: OverrideRow | undefined
  products: readonly ProductRow[]
  label: (p: ProductRow) => string
  onSaved: (printId: string, override: OverrideRow | null) => void
}) {
  const { t } = useTranslation()
  const [choice, setChoice] = useState<Choice>(choiceOf(override))
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)
  const status = printingStatus(mapping, override)
  const current = products.find(
    (p) => p.id_product === (override?.product_id ?? mapping?.product_id),
  )
  const changed = choice !== choiceOf(override)

  const save = async () => {
    setSaving(true)
    setFailed(false)
    try {
      await saveChoice(printId, choice, override !== undefined)
      onSaved(
        printId,
        choice === 'auto'
          ? null
          : {
              print_id: printId,
              product_id: choice === 'none' ? null : Number(choice),
              note: null,
            },
      )
    } catch {
      setFailed(true)
    } finally {
      setSaving(false)
    }
  }

  const selectId = `abbinamento-${printId}`
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium tabular-nums">{printId}</span>
        <span className="text-muted-foreground">{rarity}</span>
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', STATUS_STYLE[status])}>
          {t(`admin.prices.status.${status}`)}
        </span>
      </div>
      {current && <p className="text-xs text-muted-foreground">{label(current)}</p>}
      <div className="flex flex-wrap gap-2">
        <label htmlFor={selectId} className="sr-only">
          {t('admin.prices.choice', { printId })}
        </label>
        <select
          id={selectId}
          value={choice}
          onChange={(e) => {
            setChoice(e.target.value as Choice)
          }}
          className="h-9 min-w-0 flex-1 rounded-full border bg-background px-3 text-xs"
        >
          <option value={AUTO}>{t('admin.prices.auto')}</option>
          <option value={NONE}>{t('admin.prices.none')}</option>
          {products.map((p) => (
            <option key={p.id_product} value={String(p.id_product)}>
              {label(p)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!changed || saving}
          onClick={() => void save()}
          className={BUTTON}
        >
          {t('admin.prices.save')}
        </button>
      </div>
      {failed && <FormMessage tone="error">{t('account.problem.generic')}</FormMessage>}
    </li>
  )
}
