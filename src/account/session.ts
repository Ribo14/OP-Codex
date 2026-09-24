import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
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

// Il profilo è uno stato condiviso: chi sceglie lo Username nel Profilo lo vede subito anche
// il controllo nella shell (UsernameGate), senza rileggerlo né rimandare di nuovo al Profilo.
let profile: { userId: string; state: ProfileState } | null = null
const profileListeners = new Set<() => void>()
const LOADING: ProfileState = { status: 'loading' }

function setProfile(userId: string, state: ProfileState) {
  profile = { userId, state }
  for (const listener of profileListeners) listener()
}

async function loadProfile(userId: string) {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('username')
    .eq('id', userId)
    .maybeSingle()
  // Nel frattempo è cambiato utente: questo risultato non serve più.
  if (profile?.userId !== userId) return
  if (error) setProfile(userId, { status: 'error' })
  else setProfile(userId, data ? { status: 'ready', profile: data } : { status: 'missing' })
}

function subscribeProfile(listener: () => void) {
  profileListeners.add(listener)
  return () => {
    profileListeners.delete(listener)
  }
}

/** Il profilo dell'utente: "missing" finché non ha scelto lo Username. */
export function useProfile(userId: string) {
  const state = useSyncExternalStore(subscribeProfile, () =>
    profile?.userId === userId ? profile.state : LOADING,
  )
  useEffect(() => {
    if (profile?.userId === userId) return
    profile = { userId, state: LOADING }
    void loadProfile(userId)
  }, [userId])

  /** Rilegge il profilo; si può attendere (es. prima di lasciare la scelta dello Username). */
  const reload = useCallback(() => loadProfile(userId), [userId])

  return { profile: state, reload }
}
