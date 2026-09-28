// Indirizzi degli Amici (RIB-71).
export const FRIENDS_PATH = '/amici'

/** Profilo di un amico (RIB-73): i suoi mazzi e, se la condivide, la sua Collection. */
export const FRIEND_PROFILE_PATH = '/amici/:username'
export const friendProfilePath = (username: string) => `/amici/${encodeURIComponent(username)}`
export const FRIEND_DECK_PATH = '/amici/:username/mazzi/:deckId'
export const friendDeckPath = (username: string, deckId: string) =>
  `${friendProfilePath(username)}/mazzi/${deckId}`

/** Link di invito personale: chi lo apre può mandare una Friend Request con un tocco. */
export const FRIEND_INVITE_PATH = '/amici/invito/:token'
export const friendInvitePath = (token: string) => `/amici/invito/${token}`
export const friendInviteUrl = (token: string) =>
  `${window.location.origin}${friendInvitePath(token)}`
