import { DropdownMenu } from 'radix-ui'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

// Menu a tendina (Radix: tastiera, lettori di schermo, chiusura fuori dal menu già pronti).
// Lo usano il pulsante "Vista" del catalogo e il ⋯ del mazzo (RIB-88).

export const MenuRoot = DropdownMenu.Root
export const MenuTrigger = DropdownMenu.Trigger

export function MenuContent({ children, label }: { children: ReactNode; label: string }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        aria-label={label}
        align="end"
        sideOffset={6}
        collisionPadding={12}
        className="z-50 min-w-48 rounded-2xl border bg-popover p-1.5 text-sm text-popover-foreground shadow-xl"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

const ITEM =
  'flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 outline-none select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted'

export function MenuItem({
  children,
  onSelect,
  disabled,
}: {
  children: ReactNode
  onSelect: () => void
  disabled?: boolean
}) {
  return (
    <DropdownMenu.Item className={ITEM} onSelect={onSelect} disabled={disabled}>
      {children}
    </DropdownMenu.Item>
  )
}

/** Voci a scelta singola (es. la vista del catalogo): la scelta corrente ha il segno. */
export function MenuChoices<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: readonly { value: T; label: string; icon: ReactNode }[]
}) {
  return (
    <DropdownMenu.RadioGroup
      value={value}
      onValueChange={(next) => {
        const option = options.find((o) => o.value === next)
        if (option) onChange(option.value)
      }}
    >
      {options.map((option) => (
        <DropdownMenu.RadioItem
          key={option.value}
          value={option.value}
          className={cn(ITEM, 'data-[state=checked]:font-semibold')}
        >
          {option.icon}
          <span className="flex-1">{option.label}</span>
          <DropdownMenu.ItemIndicator className="size-2 rounded-full bg-foreground" />
        </DropdownMenu.RadioItem>
      ))}
    </DropdownMenu.RadioGroup>
  )
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Label className="px-3 pt-1.5 pb-1 text-xs text-muted-foreground">
      {children}
    </DropdownMenu.Label>
  )
}
