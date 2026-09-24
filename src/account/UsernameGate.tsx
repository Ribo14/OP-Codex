import type { User } from '@supabase/supabase-js'
import { Navigate, useLocation } from 'react-router'
import { ACCOUNT_PATHS, PROFILE_PATH } from './paths'
import { RETURN_PARAM } from './return-path'
import { useProfile, useSession } from './session'

/**
 * Chi ha un account ma non ha ancora scelto lo Username (es. primo accesso con Google, o con
 * l'email da un'altra pagina) va prima al Profilo a sceglierlo, poi torna dov'era.
 */
export function UsernameGate() {
  const session = useSession()
  if (session.status !== 'signedIn') return null
  return <Gate user={session.user} />
}

function Gate({ user }: { user: User }) {
  const { profile } = useProfile(user.id)
  const { pathname, search } = useLocation()
  if (profile.status !== 'missing') return null
  if (pathname === PROFILE_PATH || ACCOUNT_PATHS.includes(pathname)) return null
  const back = new URLSearchParams({ [RETURN_PARAM]: pathname + search })
  return <Navigate to={`${PROFILE_PATH}?${back.toString()}`} replace />
}
