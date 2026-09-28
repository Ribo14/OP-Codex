import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'
import { useSession } from '@/account/session'
import { countReceived, FRIENDS_CHANGED } from './friends-api'

// Badge delle Friend Request ricevute (RIB-71): niente push, il numero si rilegge aprendo una
// pagina, tornando sull'app e dopo ogni azione sugli amici.

export function usePendingRequests(): number {
  const session = useSession()
  const { pathname } = useLocation()
  const userId = session.status === 'signedIn' && !session.needsCode ? session.user.id : null
  const [count, setCount] = useState(0)

  useEffect(() => {
    // Senza accesso il badge è 0 (vedi sotto): non serve leggere nulla.
    if (!userId) return
    let active = true
    const refresh = () => {
      // Senza connessione o senza Username il badge resta com'era.
      countReceived(userId).then(
        (n) => {
          if (active) setCount(n)
        },
        () => undefined,
      )
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    refresh()
    window.addEventListener(FRIENDS_CHANGED, refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      window.removeEventListener(FRIENDS_CHANGED, refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId, pathname])

  return userId ? count : 0
}
