import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { getSupabase } from '@/lib/supabase'

// Sessione dell'utente (RIB-14), come la vede tutta l'app. Supabase la tiene nel browser e la
// rinnova da solo; qui la si espone ai componenti.

export type SessionState =
  { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; user: User }

let state: SessionState = { status: 'loading' }
const listeners = new Set<() => void>()
let started = false

function start() {
  if (started) return
  started = true
  try {
    // Prima notifica: INITIAL_SESSION, con la sessione salvata o null.
    getSupabase().auth.onAuthStateChange((_event, session) => {
      state = session ? { status: 'signedIn', user: session.user } : { status: 'signedOut' }
      for (const listener of listeners) listener()
    })
  } catch {
    // Supabase non configurato (es. nei test): nessun account possibile.
    state = { status: 'signedOut' }
  }
}

function subscribe(listener: () => void) {
  start()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, () => state)
}

export interface Profile {
  username: string
}

export type ProfileState =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; profile: Profile }
  | { status: 'error' }

/** Il profilo dell'utente: "missing" finché non ha scelto lo Username. */
export function useProfile(userId: string) {
  const [profile, setProfile] = useState<ProfileState>({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    const load = async () => {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle()
      if (!active) return
      if (error) setProfile({ status: 'error' })
      else setProfile(data ? { status: 'ready', profile: data } : { status: 'missing' })
    }
    void load()
    return () => {
      active = false
    }
  }, [userId, version])

  const reload = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])

  return { profile, reload }
}
