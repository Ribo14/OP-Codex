import { Monitor, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { nextPreference, THEME_ORDER, useTheme, type ThemePreference } from './theme'

const ICONS = { system: Monitor, light: Sun, dark: Moon } as const

/** Pulsante compatto che passa da Sistema a Chiaro a Scuro (telefono). */
export function ThemeCycleButton({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { preference, choose } = useTheme()
  const next = nextPreference(preference)
  const Icon = ICONS[preference]
  return (
    <button
      type="button"
      onClick={() => {
        choose(next)
      }}
      aria-label={t('theme.cycle', { current: t(`theme.${preference}`), next: t(`theme.${next}`) })}
      title={t('theme.cycle', { current: t(`theme.${preference}`), next: t(`theme.${next}`) })}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-full text-foreground/80 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        className,
      )}
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  )
}

/** Scelta esplicita a tre opzioni (desktop). */
export function ThemeSegmented() {
  const { t } = useTranslation()
  const { preference, choose } = useTheme()
  return (
    <div role="radiogroup" aria-label={t('theme.label')} className="flex rounded-full bg-muted p-1">
      {THEME_ORDER.map((option: ThemePreference) => {
        const Icon = ICONS[option]
        const selected = option === preference
        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(`theme.${option}`)}
            title={t(`theme.${option}`)}
            onClick={() => {
              choose(option)
            }}
            className={cn(
              'inline-flex flex-1 items-center justify-center rounded-full py-1.5 transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
              selected
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}
