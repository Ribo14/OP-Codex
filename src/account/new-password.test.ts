import { describe, expect, it, vi } from 'vitest'
import { newPasswordProblem } from './new-password'

describe('nuova password', () => {
  it('troppo corta: rifiutata senza nemmeno chiedere al servizio', async () => {
    const pwned = vi.fn(() => Promise.resolve(false))
    expect(await newPasswordProblem('corta12345'.slice(0, 9), pwned)).toBe('short')
    expect(pwned).not.toHaveBeenCalled()
  })

  it('trapelata: rifiutata', async () => {
    expect(await newPasswordProblem('password1234', () => Promise.resolve(true))).toBe('pwned')
  })

  it('lunga e non trapelata, o controllo non riuscito: accettata', async () => {
    expect(await newPasswordProblem('una frase lunga', () => Promise.resolve(false))).toBeNull()
    expect(await newPasswordProblem('una frase lunga', () => Promise.resolve(null))).toBeNull()
  })
})
