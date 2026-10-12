import { Columns2, Grid2x2, Grid3x3, List } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuChoices, MenuContent, MenuRoot, MenuTrigger } from '@/components/Menu'
import type { GridSize } from './grid-size'

/** Elenco oppure carte grandi, medie o piccole (RIB-79, RIB-88). */
export type ViewChoice = 'list' | GridSize

const ICONS = { list: List, large: Columns2, medium: Grid2x2, small: Grid3x3 } as const

/**
 * Un solo pulsante per la vista dei risultati, invece di due gruppi di pulsanti che su telefono
 * occupavano una riga in più (RIB-88). Senza `withList` (Collezione) solo le dimensioni.
 */
export function ViewMenu({
  value,
  onChange,
  withList = true,
  children,
}: {
  value: ViewChoice
  onChange: (value: ViewChoice) => void
  withList?: boolean
  /** Altre scelte nello stesso menu, dopo la vista (es. l'ordinamento della Collezione). */
  children?: ReactNode
}) {
  const { t } = useTranslation()
  const Current = ICONS[value]
  const choices: ViewChoice[] = withList
    ? ['list', 'large', 'medium', 'small']
    : ['large', 'medium', 'small']
  const label = (choice: ViewChoice) =>
    choice === 'list' ? t('catalog.list') : t(`catalog.gridSizes.${choice}`)
  return (
    <MenuRoot>
      <MenuTrigger
        aria-label={t('catalog.viewMenu', { current: label(value) })}
        title={t('catalog.view')}
        className="inline-flex size-10 shrink-0 items-center justify-center rounded-full border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Current className="size-4" aria-hidden="true" />
      </MenuTrigger>
      <MenuContent label={t('catalog.view')}>
        <MenuChoices
          value={value}
          onChange={onChange}
          options={choices.map((choice) => {
            const Icon = ICONS[choice]
            return {
              value: choice,
              label: label(choice),
              icon: <Icon className="size-4" aria-hidden="true" />,
            }
          })}
        />
        {children}
      </MenuContent>
    </MenuRoot>
  )
}
