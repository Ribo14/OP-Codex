// Indirizzi degli Amici (RIB-71).
export const FRIENDS_PATH = '/amici'

/** Link di invito personale: chi lo apre può mandare una Friend Request con un tocco. */
export const FRIEND_INVITE_PATH = '/amici/invito/:token'
export const friendInvitePath = (token: string) => `/amici/invito/${token}`
export const friendInviteUrl = (token: string) =>
  `${window.location.origin}${friendInvitePath(token)}`
