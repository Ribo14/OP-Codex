import { X } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { CatalogSet } from './catalog-data'
import {
  BAN_FILTERS,
  CATEGORIES,
  COLORS,
  EFFECT_SHORTCUTS,
  type catalogFacets,
  type CatalogFilters,
  type Range,
} from './filters'
import { toggle } from './use-catalog-filters'

type Facets = ReturnType<typeof catalogFacets>
type Update = (patch: Partial<CatalogFilters>) => void

const GAME_COLOR_CLASS: Record<(typeof COLORS)[number], string> = {
  Red: 'bg-game-red',
  Green: 'bg-game-green',
  Blue: 'bg-game-blue',
  Purple: 'bg-game-purple',
  Black: 'bg-game-black',
  Yellow: 'bg-game-yellow',
}

const COST_STEPS = Array.from({ length: 11 }, (_, i) => i)
const POWER_STEPS = Array.from({ length: 14 }, (_, i) => i * 1000)
const COUNTER_STEPS = [0, 1000, 2000]
const TOP_KEYWORDS = 10

export function FiltersPanel({
  filters,
  update,
  facets,
  sets,
  showOwned = false,
}: {
  filters: CatalogFilters
  update: Update
  facets: Facets
  sets: readonly CatalogSet[]
  /** Filtro "possedute" (RIB-22): solo per chi ha fatto l'accesso. */
  showOwned?: boolean
}) {
  const { t } = useTranslation()
  const [allKeywords, setAllKeywords] = useState(false)
  // Le più frequenti, più quelle già scelte (anche se meno frequenti restano sempre visibili).
  const keywords = allKeywords
    ? facets.keywords
    : facets.keywords.filter((k, i) => i < TOP_KEYWORDS || filters.keywords.includes(k))

  return (
    <div className="space-y-6">
      {showOwned && (
        <Group title={t('filters.owned')}>
          {(
            [
              [null, t('filters.ownedAny')],
              [true, t('filters.ownedYes')],
              [false, t('filters.ownedNo')],
            ] as const
          ).map(([value, label]) => (
            <Chip
              key={String(value)}
              selected={filters.owned === value}
              onClick={() => {
                update({ owned: value })
              }}
            >
              {label}
            </Chip>
          ))}
        </Group>
      )}

      <Group title={t('filters.colors')}>
        {COLORS.map((color) => (
          <Chip
            key={color}
            selected={filters.colors.includes(color)}
            onClick={() => {
              update({ colors: toggle(filters.colors, color) })
            }}
          >
            <span
              className={cn('size-2.5 rounded-full', GAME_COLOR_CLASS[color])}
              aria-hidden="true"
            />
            {t(`color.${color}`)}
          </Chip>
        ))}
      </Group>

      <Group title={t('filters.categories')}>
        {CATEGORIES.map((category) => (
          <Chip
            key={category}
            selected={filters.categories.includes(category)}
            onClick={() => {
              update({ categories: toggle(filters.categories, category) })
            }}
          >
            {t(`category.${category}`)}
          </Chip>
        ))}
      </Group>

      <Group title={t('filters.keywords')}>
        {keywords.map((keyword) => (
          <Chip
            key={keyword}
            selected={filters.keywords.includes(keyword)}
            onClick={() => {
              update({ keywords: toggle(filters.keywords, keyword) })
            }}
          >
            {keyword}
          </Chip>
        ))}
        {facets.keywords.length > TOP_KEYWORDS && (
          <button
            type="button"
            onClick={() => {
              setAllKeywords((v) => !v)
            }}
            className="px-2 py-1 text-xs font-medium text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            {allKeywords
              ? t('filters.keywordsLess')
              : t('filters.keywordsMore', { count: facets.keywords.length })}
          </button>
        )}
      </Group>

      <Group title={t('filters.effects')} hint={t('filters.effectsHint')}>
        {EFFECT_SHORTCUTS.map((shortcut) => (
          <Chip
            key={shortcut.id}
            selected={filters.effects.includes(shortcut.id)}
            title={t('filters.effectSearches', { pattern: shortcut.shows })}
            onClick={() => {
              update({ effects: toggle(filters.effects, shortcut.id) })
            }}
          >
            {t(`effect.${shortcut.id}`)}
          </Chip>
        ))}
      </Group>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
        <RangeFilter
          label={t('filters.cost')}
          steps={COST_STEPS}
          value={filters.cost}
          onChange={(cost) => {
            update({ cost })
          }}
        />
        <RangeFilter
          label={t('filters.power')}
          steps={POWER_STEPS}
          value={filters.power}
          onChange={(power) => {
            update({ power })
          }}
        />
        <RangeFilter
          label={t('filters.counter')}
          steps={COUNTER_STEPS}
          value={filters.counter}
          onChange={(counter) => {
            update({ counter })
          }}
        />
      </div>

      <MultiInput
        label={t('filters.types')}
        placeholder={t('filters.typesPlaceholder')}
        options={facets.types}
        selected={filters.types}
        onChange={(types) => {
          update({ types })
        }}
      />

      <Group title={t('filters.attributes')}>
        {facets.attributes.map((attribute) => (
          <Chip
            key={attribute}
            selected={filters.attributes.includes(attribute)}
            onClick={() => {
              update({ attributes: toggle(filters.attributes, attribute) })
            }}
          >
            {attribute}
          </Chip>
        ))}
      </Group>

      <MultiInput
        label={t('filters.sets')}
        placeholder={t('filters.setsPlaceholder')}
        options={sets.map((s) => s.code)}
        optionLabel={(code) => `${code} · ${sets.find((s) => s.code === code)?.name ?? ''}`}
        selected={filters.sets}
        onChange={(selected) => {
          update({ sets: selected })
        }}
      />

      <Group title={t('filters.rarities')}>
        {facets.rarities.map((rarity) => (
          <Chip
            key={rarity}
            selected={filters.rarities.includes(rarity)}
            onClick={() => {
              update({ rarities: toggle(filters.rarities, rarity) })
            }}
          >
            {rarity}
          </Chip>
        ))}
      </Group>

      <Group title={t('filters.blocks')}>
        {facets.blocks.map((block) => (
          <Chip
            key={block}
            selected={filters.blocks.includes(block)}
            onClick={() => {
              update({ blocks: toggle(filters.blocks, block) })
            }}
          >
            {block}
          </Chip>
        ))}
      </Group>

      <Group title={t('filters.trigger')}>
        {(
          [
            [null, t('filters.triggerAny')],
            [true, t('filters.triggerYes')],
            [false, t('filters.triggerNo')],
          ] as const
        ).map(([value, label]) => (
          <Chip
            key={String(value)}
            selected={filters.trigger === value}
            onClick={() => {
              update({ trigger: value })
            }}
          >
            {label}
          </Chip>
        ))}
      </Group>

      {/* RIB-50: la Ban List in vigore oggi (le voci annunciate per il futuro non contano). */}
      <Group title={t('filters.ban')} hint={t('filters.banHint')}>
        {BAN_FILTERS.map((id) => (
          <Chip
            key={id}
            selected={filters.ban.includes(id)}
            onClick={() => {
              update({ ban: toggle(filters.ban, id) })
            }}
          >
            {t(`filters.banOption.${id}`)}
          </Chip>
        ))}
      </Group>

      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={filters.allPrintings}
          onChange={(e) => {
            update({ allPrintings: e.target.checked })
          }}
          className="mt-0.5 size-4 accent-foreground"
        />
        {t('filters.allPrintings')}
      </label>
    </div>
  )
}

function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  )
}

function Chip({
  selected,
  onClick,
  title,
  children,
}: {
  selected: boolean
  onClick: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={title}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        selected
          ? 'border-foreground bg-foreground text-background'
          : 'border-border text-foreground/80 hover:border-foreground/40',
      )}
    >
      {children}
    </button>
  )
}

function RangeFilter({
  label,
  steps,
  value,
  onChange,
}: {
  label: string
  steps: readonly number[]
  value: Range
  onChange: (value: Range) => void
}) {
  const { t } = useTranslation()
  const [min, max] = value
  const select = (current: number | null, change: (v: number | null) => void, aria: string) => (
    <select
      aria-label={aria}
      value={current === null ? '' : String(current)}
      onChange={(e) => {
        change(e.target.value === '' ? null : Number(e.target.value))
      }}
      className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-sm"
    >
      <option value="">{t('filters.any')}</option>
      {steps.map((step) => (
        <option key={step} value={step}>
          {step}
        </option>
      ))}
    </select>
  )
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        {label}
      </legend>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {t('filters.min')}
        {select(
          min,
          (v) => {
            onChange([v, max])
          },
          `${label} ${t('filters.min')}`,
        )}
        {t('filters.max')}
        {select(
          max,
          (v) => {
            onChange([min, v])
          },
          `${label} ${t('filters.max')}`,
        )}
      </div>
    </fieldset>
  )
}

/** Scelta multipla con completamento automatico, per elenchi lunghi (Type, Set). */
function MultiInput({
  label,
  placeholder,
  options,
  optionLabel = (o) => o,
  selected,
  onChange,
}: {
  label: string
  placeholder: string
  options: readonly string[]
  optionLabel?: (option: string) => string
  selected: readonly string[]
  onChange: (selected: string[]) => void
}) {
  const { t } = useTranslation()
  const id = useId()
  const [text, setText] = useState('')

  const add = (raw: string) => {
    const value = options.find((o) => o.toLowerCase() === raw.trim().toLowerCase())
    if (value && !selected.includes(value)) onChange([...selected, value])
    setText('')
  }

  return (
    <div className="space-y-2">
      <label
        htmlFor={id}
        className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          list={`${id}-options`}
          value={text}
          placeholder={placeholder}
          onChange={(e) => {
            const value = e.target.value
            // Scegliendo una voce dell'elenco la si aggiunge subito.
            if (options.includes(value)) add(value)
            else setText(value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add(text)
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-3 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            add(text)
          }}
          className="h-9 rounded-lg border px-3 text-xs font-medium hover:bg-muted"
        >
          {t('filters.typesAdd')}
        </button>
      </div>
      <datalist id={`${id}-options`}>
        {options
          .filter((o) => !selected.includes(o))
          .map((o) => (
            <option key={o} value={o} label={optionLabel(o)} />
          ))}
      </datalist>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 rounded-full bg-foreground py-1 pr-1 pl-3 text-xs font-medium text-background"
            >
              {value}
              <button
                type="button"
                aria-label={t('filters.remove', { value })}
                onClick={() => {
                  onChange(selected.filter((v) => v !== value))
                }}
                className="inline-flex size-5 items-center justify-center rounded-full hover:bg-background/20"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
