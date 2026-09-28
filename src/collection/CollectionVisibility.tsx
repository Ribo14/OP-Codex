import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getSupabase } from '@/lib/supabase'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'

// Chi vede la Collection (RIB-73, ADR-0015): Privata (predefinita) o Amici. Gli amici vedono le
// carte e la Set Completion, mai il valore stimato.

const COLLECTION_VISIBILITIES = ['private', 'friends'] as const
type CollectionVisibility = (typeof COLLECTION_VISIBILITIES)[number]

async function loadVisibility(userId: string): Promise<CollectionVisibility> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('collection_visibility')
    .eq('id', userId)
    .single()
  if (error) throw new Error(error.message)
  return data.collection_visibility === 'friends' ? 'friends' : 'private'
}

async function saveVisibility(userId: string, visibility: CollectionVisibility) {
  const { error } = await getSupabase()
    .from('profiles')
    .update({ collection_visibility: visibility })
    .eq('id', userId)
  if (error) throw new Error(error.message)
}

export function CollectionVisibilityRow({ userId }: { userId: string }) {
  const { t } = useTranslation()
  const online = useOnline()
  const [value, setValue] = useState<CollectionVisibility | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let active = true
    loadVisibility(userId).then(
      (v) => {
        if (active) setValue(v)
      },
      () => undefined,
    )
    return () => {
      active = false
    }
  }, [userId])

  // Senza connessione (o finché non si sa) la riga non compare: non c'è nulla da cambiare.
  if (value === null) return null

  const choose = (next: CollectionVisibility) => {
    if (next === value) return
    setBusy(true)
    setFailed(false)
    saveVisibility(userId, next).then(
      () => {
        setValue(next)
        setBusy(false)
      },
      () => {
        setBusy(false)
        setFailed(true)
      },
    )
  }

  return (
    <div className="space-y-2 sm:max-w-md">
      <div className="flex items-center gap-3">
        <span id="visibilita-collezione" className="text-sm text-muted-foreground">
          {t('collection.visibility.label')}
        </span>
        <div
          role="radiogroup"
          aria-labelledby="visibilita-collezione"
          className="grid flex-1 grid-cols-2 gap-1 rounded-full bg-muted p-1 text-xs font-medium"
        >
          {COLLECTION_VISIBILITIES.map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={value === v}
              disabled={busy || !online}
              onClick={() => {
                choose(v)
              }}
              className={cn(
                'h-8 rounded-full px-2 disabled:opacity-60',
                value === v
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t(`collection.visibility.${v}`)}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t(`collection.visibility.${value}Hint`)}</p>
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t('friends.actionFailed')}
        </p>
      )}
    </div>
  )
}
