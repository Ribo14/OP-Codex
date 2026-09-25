import { Check, Copy, Share2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { canShare, copyText } from '@/lib/clipboard'

// Esporta la Deck List (RIB-24): "Copia lista" negli appunti e, sui telefoni, "Condividi" con il
// menu del sistema (WhatsApp, Messaggi…). Il testo è nel formato "4xOP01-016" di OPTCG Sim.

const BUTTON =
  'inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-medium hover:bg-muted'

export function DeckListActions({ name, text }: { name: string; text: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null)

  return (
    <>
      <button
        type="button"
        onClick={() => {
          void copyText(text).then((ok) => {
            setCopied(ok ? 'ok' : 'failed')
            window.setTimeout(() => {
              setCopied(null)
            }, 2500)
          })
        }}
        className={BUTTON}
      >
        {copied === 'ok' ? (
          <Check className="size-3.5" aria-hidden="true" />
        ) : (
          <Copy className="size-3.5" aria-hidden="true" />
        )}
        {copied === 'ok' ? t('decks.list.copied') : t('decks.list.copy')}
      </button>
      {canShare() && (
        <button
          type="button"
          onClick={() => {
            // Annullare la condivisione non è un errore.
            void navigator.share({ title: name, text }).catch(() => undefined)
          }}
          className={BUTTON}
        >
          <Share2 className="size-3.5" aria-hidden="true" />
          {t('decks.list.share')}
        </button>
      )}
      <span role="status" className="sr-only">
        {copied === 'ok' ? t('decks.list.copied') : ''}
      </span>
      {copied === 'failed' && (
        <span role="alert" className="text-xs text-destructive">
          {t('decks.list.copyFailed')}
        </span>
      )}
    </>
  )
}
