import { Check, Copy, Link2, Link2Off, Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { canShare, copyText } from '@/lib/clipboard'
import { cn } from '@/lib/utils'
import { DECK_VISIBILITIES, toVisibility, type DeckSummary, type DeckVisibility } from './deck'
import type { DeckStore } from './deck-store'
import { createShareLink, revokeShareLink, setDeckVisibility } from './decks-api'
import { sharedDeckUrl } from './paths'

// "Condividi mazzo" nell'editor: chi vede il Deck, a tre livelli crescenti (RIB-73): Privato,
// Amici (dal tuo profilo), Link pubblico (RIB-26: chiunque abbia il link, anche senza account,
// e gli amici). Il link si copia, si condivide e si revoca.

const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted disabled:opacity-50'

export function ShareDeckSection({
  deck,
  store,
  disabled,
}: {
  deck: DeckSummary
  store: DeckStore
  disabled: boolean
}) {
  const { t } = useTranslation()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)
  const url = deck.shareToken ? sharedDeckUrl(deck.shareToken) : null
  const visibility = toVisibility(deck.visibility, deck.shareToken)

  const run = (next: DeckVisibility, action: () => Promise<string | null>) => {
    setBusy(true)
    setFailed(false)
    void action().then(
      (token) => {
        store.showSharing(next, token)
        setBusy(false)
        setConfirmRevoke(false)
      },
      () => {
        setBusy(false)
        setFailed(true)
      },
    )
  }

  const choose = (next: DeckVisibility) => {
    if (next === visibility) return
    run(next, () => (next === 'link' ? createShareLink(deck.id) : setDeckVisibility(deck.id, next)))
  }

  return (
    <details className="rounded-2xl border text-sm">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium">
        <Link2 className="size-4 shrink-0" aria-hidden="true" />
        {t('decks.share.title')}
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {t(`decks.visibility.${visibility}`)}
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        <div
          role="radiogroup"
          aria-label={t('decks.visibility.label')}
          className="grid grid-cols-3 gap-1 rounded-full bg-muted p-1 text-xs font-medium"
        >
          {DECK_VISIBILITIES.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={visibility === v}
              disabled={busy || disabled}
              onClick={() => {
                choose(v)
              }}
              className={cn(
                'h-8 rounded-full px-2 disabled:opacity-60',
                visibility === v
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`decks.visibility.${v}`)}
            </button>
          ))}
        </div>
        {url ? (
          <>
            <p className="text-muted-foreground">{t('decks.share.activeHint')}</p>
            <p className="rounded-lg bg-muted px-3 py-2 font-mono text-xs break-all select-all">
              {url}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  void copyText(url).then((ok) => {
                    setCopied(ok)
                    window.setTimeout(() => {
                      setCopied(false)
                    }, 2500)
                  })
                }}
                className={BUTTON}
              >
                {copied ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : (
                  <Copy className="size-3.5" aria-hidden="true" />
                )}
                {copied ? t('decks.share.copied') : t('decks.share.copy')}
              </button>
              {canShare() && (
                <button
                  type="button"
                  onClick={() => {
                    void navigator.share({ title: deck.name, url }).catch(() => undefined)
                  }}
                  className={BUTTON}
                >
                  <Share2 className="size-3.5" aria-hidden="true" />
                  {t('decks.share.send')}
                </button>
              )}
              {confirmRevoke ? (
                <span
                  role="alertdialog"
                  aria-label={t('decks.share.revokeConfirm')}
                  className="flex gap-2"
                >
                  <button
                    type="button"
                    disabled={busy || disabled}
                    onClick={() => {
                      run('private', () => revokeShareLink(deck.id).then(() => null))
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full bg-destructive px-3 text-xs font-medium text-white disabled:opacity-50"
                  >
                    <Link2Off className="size-3.5" aria-hidden="true" />
                    {t('decks.share.revoke')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmRevoke(false)
                    }}
                    className={BUTTON}
                  >
                    {t('decks.cancel')}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setConfirmRevoke(true)
                  }}
                  className={BUTTON}
                >
                  <Link2Off className="size-3.5" aria-hidden="true" />
                  {t('decks.share.revoke')}
                </button>
              )}
            </div>
            {confirmRevoke && (
              <p className="text-xs text-muted-foreground">{t('decks.share.revokeHint')}</p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground">
            {visibility === 'friends'
              ? t('decks.visibility.friendsHint')
              : t('decks.visibility.privateHint')}
          </p>
        )}
        {failed && (
          <p role="alert" className="text-xs text-destructive">
            {t('decks.saveFailed')}
          </p>
        )}
      </div>
    </details>
  )
}
