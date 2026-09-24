import { isPwnedPassword } from './pwned'

/** Lunghezza minima, la stessa impostata in Supabase (config.toml e dashboard). */
export const PASSWORD_MIN = 10

export type PasswordProblem = 'short' | 'pwned'

/** Controlli su una nuova password prima di mandarla a Supabase. */
export async function newPasswordProblem(
  password: string,
  pwned: (password: string) => Promise<boolean | null> = isPwnedPassword,
): Promise<PasswordProblem | null> {
  if (password.length < PASSWORD_MIN) return 'short'
  // null = controllo non riuscito: non blocca, la lunghezza la verifica comunque il server.
  if ((await pwned(password)) === true) return 'pwned'
  return null
}
