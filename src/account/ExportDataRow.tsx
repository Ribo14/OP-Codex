import type { User } from '@supabase/supabase-js'
import { Download, FileArchive } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCatalog } from '@/catalog/local-catalog'
import { sharedDeckUrl } from '@/decks/paths'
import { useOnline } from '@/lib/use-online'
import { createZip } from '@/lib/zip'
import { exportFileName, exportFiles } from './data-export'
import { deliverFile, loadExportData } from './data-export-api'
import { FormMessage } from './form'
import { SettingsRow } from './SettingsRow'

// "Esporta i miei dati" (RIB-28). Due tocchi: il primo prepara l'archivio (serve la rete), il
// secondo lo consegna. Su iOS la condivisione deve partire subito da un tocco, e dopo le
// richieste al server quel tocco non varrebbe più.

type State =
  { step: 'idle' } | { step: 'busy' } | { step: 'ready'; file: File } | { step: 'failed' }

const BUTTON =
  'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50'
const PRIMARY =
  'inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50'

export function ExportDataRow({ user }: { user: User }) {
  const { t } = useTranslation()
  return (
    <SettingsRow
      icon={FileArchive}
      title={t('account.export.title')}
      hint={t('account.export.rowHint')}
    >
      <ExportData user={user} />
    </SettingsRow>
  )
}

function ExportData({ user }: { user: User }) {
  const { t } = useTranslation()
  const { catalog } = useCatalog()
  const online = useOnline()
  const [state, setState] = useState<State>({ step: 'idle' })

  const prepare = async () => {
    if (!catalog) return
    setState({ step: 'busy' })
    try {
      const data = await loadExportData(user, sharedDeckUrl)
      const zip = createZip(exportFiles(data, catalog))
      const file = new File([zip], exportFileName(data), { type: 'application/zip' })
      setState({ step: 'ready', file })
    } catch {
      setState({ step: 'failed' })
    }
  }

  const deliver = (file: File) => {
    deliverFile(file).catch(() => {
      setState({ step: 'failed' })
    })
  }

  return (
    <div className="max-w-sm space-y-3">
      <p className="text-sm text-muted-foreground">{t('account.export.intro')}</p>
      {state.step === 'ready' ? (
        <>
          <button
            type="button"
            className={PRIMARY}
            onClick={() => {
              deliver(state.file)
            }}
          >
            <Download className="size-4" aria-hidden="true" />
            {t('account.export.download', {
              size: Math.max(1, Math.round(state.file.size / 1024)),
            })}
          </button>
          <p className="text-xs text-muted-foreground">{state.file.name}</p>
        </>
      ) : (
        <button
          type="button"
          className={BUTTON}
          disabled={state.step === 'busy' || !online || !catalog}
          onClick={() => void prepare()}
        >
          {state.step === 'busy' ? t('account.export.preparing') : t('account.export.prepare')}
        </button>
      )}
      {!online && state.step !== 'ready' && (
        <p className="text-sm text-muted-foreground">{t('account.export.offline')}</p>
      )}
      {state.step === 'failed' && (
        <FormMessage tone="error">{t('account.export.failed')}</FormMessage>
      )}
    </div>
  )
}
