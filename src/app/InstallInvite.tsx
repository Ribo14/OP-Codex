import { Download, Share, SquarePlus, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { InstallContext } from './install'

/**
 * Invito all'installazione sul telefono, sopra la barra in basso: discreto, si chiude
 * e non riappare per un po'. Su Android installa, su iPhone/iPad spiega come fare.
 */
export function InstallInvite({
  context,
  onInstall,
  onDismiss,
}: {
  context: InstallContext
  onInstall: () => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()

  return (
    <aside
      aria-label={t('install.title')}
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+4.25rem)] z-40 rounded-2xl border bg-background p-4 shadow-2xl lg:hidden"
    >
      <div className="flex items-start gap-3">
        <img
          src="/icons/icon-192.png"
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-xl"
        />
        <div className="min-w-0 flex-1 space-y-2 text-sm">
          <p className="font-semibold">{t('install.title')}</p>

          {context === 'android' && <p className="text-muted-foreground">{t('install.android')}</p>}

          {context === 'ios-safari' && (
            <>
              <p className="text-muted-foreground">{t('install.iosIntro')}</p>
              <ol className="space-y-1.5">
                <Step n={1} icon={<Share className="size-4" aria-hidden="true" />}>
                  {t('install.iosStep1')}
                </Step>
                <Step n={2} icon={<SquarePlus className="size-4" aria-hidden="true" />}>
                  {t('install.iosStep2')}
                </Step>
                <Step n={3}>{t('install.iosStep3')}</Step>
              </ol>
            </>
          )}

          {context === 'ios-other' && (
            <p className="text-muted-foreground">{t('install.iosOther')}</p>
          )}

          <div className="flex gap-2 pt-1">
            {context === 'android' && (
              <button
                type="button"
                onClick={onInstall}
                className="inline-flex h-9 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background"
              >
                <Download className="size-4" aria-hidden="true" />
                {t('install.installButton')}
              </button>
            )}
            <button
              type="button"
              onClick={onDismiss}
              className={cn(
                'h-9 rounded-full px-4 text-sm font-medium',
                context === 'android' ? 'text-muted-foreground' : 'border',
              )}
            >
              {t('install.dismiss')}
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('install.close')}
          className="-mt-1 -mr-1 inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </aside>
  )
}

function Step({ n, icon, children }: { n: number; icon?: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
        {n}
      </span>
      {children}
      {icon}
    </li>
  )
}
