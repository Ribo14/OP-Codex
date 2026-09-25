import { createHmac } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import { linkFromEmail } from './mailpit.ts'

// Account e sicurezza (RIB-18) sul Supabase locale: esci da tutti i dispositivi, verifica in due
// passaggi (attivazione, codice all'accesso), eliminazione dell'account.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

const run = crypto.randomUUID().replaceAll('-', '')
const email = `e2e-sic-${run}@example.com`
const username = `sic_${run}`.slice(0, 20)
const password = `Una frase lunga per la sicurezza ${crypto.randomUUID()}`

/** Codice TOTP (RFC 6238) per la chiave in base32, nel passo di 30 secondi `step`. */
function totp(secret: string, step: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of secret.replace(/=+$/, '')) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(step))
  const hash = createHmac('sha1', Buffer.from(bytes)).update(counter).digest()
  const offset = (hash.at(-1) ?? 0) & 15
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, '0')
}

const currentStep = () => Math.floor(Date.now() / 30_000)

async function waitForCaptcha(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 20_000,
  })
}

async function login(page: Page) {
  await page.goto('/accesso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await waitForCaptcha(page)
  await page.getByRole('button', { name: 'Accedi' }).click()
}

test('esci ovunque, verifica in due passaggi ed eliminazione dell’account', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(150_000)

  // Account nuovo (registrazione via API, conferma dal link dell'email) e Username.
  const redirect = new URLSearchParams({ redirect_to: `${baseURL ?? ''}/account/conferma` })
  const signup = await fetch(`${SUPABASE_URL}/auth/v1/signup?${redirect.toString()}`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      gotrue_meta_security: { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' },
    }),
  })
  expect(signup.ok).toBe(true)
  await page.goto(await linkFromEmail(email, /Conferma/, '/account/conferma'))
  await page.getByLabel('Username').fill(username)
  await page.getByRole('button', { name: 'Conferma' }).click()
  // Il profilo compare solo a Username salvato: da qui si può cambiare pagina.
  await expect(page.getByRole('heading', { level: 1, name: `@${username}` })).toBeVisible()

  // Esci da tutti i dispositivi: anche questo.
  await page.getByRole('button', { name: 'Esci da tutti i dispositivi' }).click()
  await expect(page).toHaveURL(/\/accesso\?torna=%2Fprofilo$/)

  // Attivazione della verifica in due passaggi.
  await login(page)
  await expect(page.getByRole('heading', { level: 1, name: `@${username}` })).toBeVisible()
  await page.getByRole('button', { name: 'Attiva' }).click()
  await expect(page.getByRole('img', { name: /QR code/ })).toBeVisible()
  const secret = (await page.locator('code').innerText()).trim()
  const enrolledAt = currentStep()
  await page.getByLabel("Codice dell'app").fill(totp(secret, enrolledAt))
  await page.getByRole('button', { name: 'Conferma e attiva' }).click()
  await expect(page.getByText('Verifica in due passaggi attivata.')).toBeVisible()

  // Da ora l'accesso chiede il codice, e senza codice il profilo non si apre.
  await page.getByRole('button', { name: 'Esci', exact: true }).click()
  await login(page)
  await expect(page).toHaveURL(/\/account\/codice\?torna=/)
  await page.getByLabel("Codice dell'app").fill('000000')
  await page.getByRole('button', { name: 'Verifica' }).click()
  await expect(page.getByRole('alert')).toContainText('Codice non valido')
  // Un codice già usato non vale di nuovo: si aspetta il passo successivo.
  await expect.poll(currentStep, { timeout: 35_000, intervals: [1000] }).toBeGreaterThan(enrolledAt)
  await page.getByLabel("Codice dell'app").fill(totp(secret, currentStep()))
  await page.getByRole('button', { name: 'Verifica' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `@${username}` })).toBeVisible()

  // Eliminazione: lo Username sbagliato non basta, quello giusto cancella tutto.
  const confirm = page.getByLabel(/Per confermare, scrivi il tuo Username/)
  await confirm.fill('qualcun_altro')
  const deleteButton = page.getByRole('button', { name: "Elimina l'account per sempre" })
  await deleteButton.click()
  await expect(page.getByRole('alert')).toContainText('Lo Username non corrisponde')
  await confirm.fill(username)
  await deleteButton.click()
  await expect(page.getByRole('heading', { name: 'Account eliminato' })).toBeVisible()

  // L'account non esiste più: le credenziali non valgono.
  const again = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      gotrue_meta_security: { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' },
    }),
  })
  expect(again.status).toBe(400)
})
