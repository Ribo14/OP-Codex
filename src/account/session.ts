import type { User } from '@supabase/supabase-js'
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { clearPersonal, withOfflineCopy } from '@/lib/personal-cache'
import { getSupabase } from '@/lib/supabase'
import { needsCode } from './mfa'

// Sessione dell'utente (RIB-14), come la vede tutta l'app. Supabase la tiene nel browser e la
// rinnova da solo; qui la si espone ai componenti.

export type SessionState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  /** needsCode: ha la verifica in due passaggi e deve ancora dare il codice (RIB-18). */
  | { status: 'signedIn'; user: User; needsCode: boolean }

let state: SessionState = { status: 'loading' }
const listeners = new Set<() => void>()
let started = false

function start() {
  if (started) return
  started = true
  try {
    // Prima notifica: INITIAL_SESSION, con la sessione salvata o null.
    getSupabase().auth.onAuthStateChange((event, session) => {
      state = session
        ? { status: 'signedIn', user: session.user, needsCode: needsCode(session) }
        : { status: 'signedOut' }
      // All'uscita si cancellano i dati personali salvati per l'offline (RIB-27): un dispositivo
      // condiviso non deve mostrarli a chi viene dopo.
      if (event === 'SIGNED_OUT') void clearPersonal()
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
  let result: ProfileState
  try {
    // Offline si usa la copia salvata all'ultimo accesso online (RIB-27).
    const data = await withOfflineCopy('profile', userId, async () => {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('username')
        .eq('id', userId)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return data
    })
    result = data ? { status: 'ready', profile: data } : { status: 'missing' }
  } catch {
    result = { status: 'error' }
  }
  // Nel frattempo è cambiato utente: questo risultato non serve più.
  if (profile?.userId !== userId) return
  setProfile(userId, result)
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
