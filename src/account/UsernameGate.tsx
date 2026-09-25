import type { User } from '@supabase/supabase-js'
import { Navigate, useLocation } from 'react-router'
import { ACCOUNT_PATHS, PROFILE_PATH } from './paths'
import { codePath, RETURN_PARAM } from './return-path'
import { useProfile, useSession } from './session'

/**
 * Controllo della shell sull'account. Chi ha la verifica in due passaggi dà prima il codice
 * (RIB-18); chi non ha ancora scelto lo Username (es. primo accesso con Google, o con l'email da
 * un'altra pagina) va al Profilo a sceglierlo. In entrambi i casi poi torna dov'era.
 */
export function UsernameGate() {
  const session = useSession()
  const { pathname, search } = useLocation()
  if (session.status !== 'signedIn') return null
  if (ACCOUNT_PATHS.includes(pathname)) return null
  if (session.needsCode) return <Navigate to={codePath(pathname + search)} replace />
  return <Gate user={session.user} />
}

function Gate({ user }: { user: User }) {
  const { profile } = useProfile(user.id)
  const { pathname, search } = useLocation()
  if (profile.status !== 'missing') return null
  if (pathname === PROFILE_PATH) return null
  const back = new URLSearchParams({ [RETURN_PARAM]: pathname + search })
  return <Navigate to={`${PROFILE_PATH}?${back.toString()}`} replace />
}
