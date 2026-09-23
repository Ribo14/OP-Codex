import { useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: T }

type Settled<T> = Extract<AsyncState<T>, { status: 'error' | 'ready' }>

/**
 * Carica dati asincroni identificati da `key`; con `key` null non carica nulla.
 * `load` deve essere una funzione stabile (definita fuori dal componente).
 */
export function useAsync<T>(key: string | null, load: (key: string) => Promise<T>): AsyncState<T> {
  const [settled, setSettled] = useState<{ key: string; state: Settled<T> } | null>(null)

  useEffect(() => {
    if (key === null) return
    let active = true
    load(key).then(
      (data) => {
        if (active) setSettled({ key, state: { status: 'ready', data } })
      },
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error)
        if (active) setSettled({ key, state: { status: 'error', message } })
      },
    )
    return () => {
      active = false
    }
  }, [key, load])

  if (key === null) return { status: 'idle' }
  // Finché non arriva il risultato per la key corrente, i dati precedenti non valgono.
  return settled?.key === key ? settled.state : { status: 'loading' }
}
