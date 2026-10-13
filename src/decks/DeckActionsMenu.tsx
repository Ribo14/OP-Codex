import { Copy, MoreHorizontal, Printer, Repeat, ScanSearch, Share2, Swords } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import type { CatalogCard } from '@/catalog/catalog-data'
import {
  MenuChoices,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from '@/components/Menu'
import { canShare, copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { playtestPath } from '@/playtest/paths'
import type { DeckSummary } from './deck'
import { DECK_FORMATS, type DeckFormat } from './deck-rules'
import type { DeckStore } from './deck-store'
import { deckLeaderPath, deckPrintPath } from './paths'

interface Editing {
  store: DeckStore
  save: (action: Promise<boolean>) => void
  disabled: boolean
}

/**
 * Il menu ⋯ della testata del mazzo, solo su telefono (RIB-88): le azioni che su tablet e PC
 * restano visibili come pulsanti. Formato e variante del Leader si scelgono qui dentro.
 */
export function DeckActionsMenu({
  deck,
  leader,
  editing,
  listText,
  onRelated,
}: {
  deck: DeckSummary
  leader: CatalogCard | undefined
  editing: Editing
  listText: string
  onRelated: (leader: CatalogCard) => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)
  const base = leader?.printings[0]?.printId

  return (
    <div className="relative shrink-0 sm:hidden">
      <MenuRoot>
        <MenuTrigger
          aria-label={t('decks.actions')}
          className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <MoreHorizontal className="size-5" aria-hidden="true" />
        </MenuTrigger>
        <MenuContent label={t('decks.actions')}>
          <MenuLabel>{t('decks.format')}</MenuLabel>
          <MenuChoices<DeckFormat>
            value={deck.format}
            onChange={(format) => {
              if (!editing.disabled && format !== deck.format) {
                editing.save(editing.store.setFormat(format))
              }
            }}
            options={DECK_FORMATS.map((format) => ({
              value: format,
              label: t(`decks.formats.${format}`),
              icon: null,
            }))}
          />
          {leader && leader.printings.length > 1 && !editing.disabled && (
            <>
              <MenuSeparator />
              <MenuLabel>{t('decks.leaderPrinting')}</MenuLabel>
              <MenuChoices
                value={deck.leaderPrintId ?? base ?? ''}
                onChange={(printId) => {
                  editing.save(
                    editing.store.setLeader(deck.leaderCode, printId === base ? null : printId),
                  )
                }}
                options={leader.printings.map((p) => ({
                  value: p.printId,
                  label: `${p.printId} · ${p.rarity}`,
                  icon: null,
                }))}
              />
            </>
          )}
          <MenuSeparator />
          {/* Offline (RIB-27) il Leader non si cambia. */}
          {!editing.disabled && (
            <MenuItem
              onSelect={() => {
                void navigate(deckLeaderPath(deck.id))
              }}
            >
              <Repeat className="size-4" aria-hidden="true" />
              {t('decks.changeLeader')}
            </MenuItem>
          )}
          {leader && (
            <MenuItem
              onSelect={() => {
                onRelated(leader)
              }}
            >
              <ScanSearch className="size-4" aria-hidden="true" />
              {t('decks.related')}
            </MenuItem>
          )}
          <MenuItem
            onSelect={() => {
              void copyText(listText).then((ok) => {
                setCopied(ok ? 'ok' : 'failed')
                window.setTimeout(() => {
                  setCopied(null)
                }, 2500)
              })
            }}
          >
            <Copy className="size-4" aria-hidden="true" />
            {t('decks.list.copy')}
          </MenuItem>
          {canShare() && (
            <MenuItem
              onSelect={() => {
                void navigator.share({ title: deck.name, text: listText }).catch(() => undefined)
              }}
            >
              <Share2 className="size-4" aria-hidden="true" />
              {t('decks.list.share')}
            </MenuItem>
          )}
          <MenuItem
            onSelect={() => {
              void navigate(deckPrintPath(deck.id))
            }}
          >
            <Printer className="size-4" aria-hidden="true" />
            {t('decks.print')}
          </MenuItem>
          <MenuItem
            onSelect={() => {
              void navigate(playtestPath(deck.id))
            }}
          >
            <Swords className="size-4" aria-hidden="true" />
            {t('playtest.tryDeck')}
          </MenuItem>
        </MenuContent>
      </MenuRoot>
      {/* L'esito della copia, sotto il ⋯: il menu nel frattempo si è chiuso. */}
      <span
        role="status"
        className={cn(
          'absolute top-full right-0 z-10 mt-1 rounded-full bg-foreground px-2.5 py-1 text-xs whitespace-nowrap text-background',
          copied !== 'ok' && 'sr-only',
        )}
      >
        {copied === 'ok' ? t('decks.list.copied') : ''}
      </span>
      {copied === 'failed' && (
        <span
          role="alert"
          className="absolute top-full right-0 z-10 mt-1 rounded-full bg-destructive px-2.5 py-1 text-xs whitespace-nowrap text-white"
        >
          {t('decks.list.copyFailed')}
        </span>
      )}
    </div>
  )
}
