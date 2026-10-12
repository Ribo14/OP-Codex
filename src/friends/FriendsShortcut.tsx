import { Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import {
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from '@/components/Menu'
import { loadFriends } from './friends-api'
import { FRIENDS_PATH, friendViewPath, type FriendView } from './paths'

// Scorciatoia "Amici" in Collezione e Mazzi: la collezione e i mazzi degli amici erano solo
// nella pagina di ogni amico, troppo nascosti. Da Mazzi si aprono i mazzi dell'amico, da
// Collezione la sua collezione.

type Friends = { status: 'loading' } | { status: 'error' } | { status: 'ready'; names: string[] }

export function FriendsShortcut({ section }: { section: FriendView }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [friends, setFriends] = useState<Friends>({ status: 'loading' })

  // Gli amici si leggono quando si apre il menu: niente richieste se non serve.
  const load = () => {
    setFriends({ status: 'loading' })
    loadFriends().then(
      (state) => {
        setFriends({ status: 'ready', names: state.friends.map((f) => f.username) })
      },
      () => {
        setFriends({ status: 'error' })
      },
    )
  }

  return (
    <MenuRoot
      onOpenChange={(open) => {
        if (open) load()
      }}
    >
      <MenuTrigger className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3 text-sm font-medium hover:bg-muted">
        <Users className="size-4" aria-hidden="true" />
        {t('friends.title')}
      </MenuTrigger>
      <MenuContent label={t(`friends.shortcut.${section}`)}>
        <MenuLabel>{t(`friends.shortcut.${section}`)}</MenuLabel>
        {friends.status === 'loading' && (
          <MenuItem disabled onSelect={() => undefined}>
            {t('account.loading')}
          </MenuItem>
        )}
        {friends.status === 'error' && (
          <MenuItem disabled onSelect={() => undefined}>
            {t('friends.shortcut.failed')}
          </MenuItem>
        )}
        {friends.status === 'ready' && friends.names.length === 0 && (
          <MenuItem disabled onSelect={() => undefined}>
            {t('friends.shortcut.none')}
          </MenuItem>
        )}
        {friends.status === 'ready' &&
          friends.names.map((name) => (
            <MenuItem
              key={name}
              onSelect={() => {
                void navigate(friendViewPath(name, section))
              }}
            >
              <span
                aria-hidden="true"
                className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs font-semibold text-background uppercase"
              >
                {name.charAt(0)}
              </span>
              @{name}
            </MenuItem>
          ))}
        <MenuSeparator />
        <MenuItem
          onSelect={() => {
            void navigate(FRIENDS_PATH)
          }}
        >
          {t('friends.shortcut.manage')}
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  )
}
