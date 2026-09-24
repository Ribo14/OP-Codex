// Regole dello Username (RIB-14). Le stesse del database (migrazione profiles): qui servono
// solo a dare subito un messaggio chiaro, il controllo vero lo fa Postgres.

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20

const FORMAT = /^[A-Za-z0-9_]+$/

const RESERVED = new Set([
  'admin',
  'administrator',
  'amministratore',
  'moderator',
  'moderatore',
  'mod',
  'opcodex',
  'op_codex',
  'support',
  'supporto',
  'staff',
  'system',
  'root',
  'bandai',
])

export type UsernameProblem = 'length' | 'characters' | 'reserved'

export function usernameProblem(username: string): UsernameProblem | null {
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) return 'length'
  if (!FORMAT.test(username)) return 'characters'
  if (RESERVED.has(username.toLowerCase())) return 'reserved'
  return null
}
