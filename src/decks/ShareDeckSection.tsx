import { Check, Copy, Link2, Link2Off, Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { canShare, copyText } from '@/lib/clipboard'
import type { DeckSummary } from './deck'
import type { DeckStore } from './deck-store'
import { createShareLink, revokeShareLink } from './decks-api'
import { sharedDeckUrl } from './paths'

// "Condividi mazzo" nell'editor (RIB-26): crea lo Share Link, lo copia o lo condivide, lo
// revoca. Chiunque abbia il link vede il Deck in sola lettura, anche senza account.

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

  const run = (action: () => Promise<string | null>) => {
    setBusy(true)
    setFailed(false)
    void action().then(
      (token) => {
        store.showShareToken(token)
        setBusy(false)
        setConfirmRevoke(false)
      },
      () => {
        setBusy(false)
        setFailed(true)
      },
    )
  }

  return (
    <details className="rounded-2xl border text-sm">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-medium">
        <Link2 className="size-4 shrink-0" aria-hidden="true" />
        {t('decks.share.title')}
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {url ? t('decks.share.active') : t('decks.share.private')}
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
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
                      run(() => revokeShareLink(deck.id).then(() => null))
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
          <>
            <p className="text-muted-foreground">{t('decks.share.intro')}</p>
            <button
              type="button"
              disabled={busy || disabled}
              onClick={() => {
                run(() => createShareLink(deck.id))
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background disabled:opacity-50"
            >
              <Link2 className="size-3.5" aria-hidden="true" />
              {t('decks.share.create')}
            </button>
          </>
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
