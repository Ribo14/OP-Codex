import { expect, test, type Page } from '@playwright/test'
import { linkFromEmail } from './mailpit.ts'

// Flusso principale degli account (RIB-14) sul Supabase locale: registrazione, conferma
// dell'email, Username, uscita, accesso, recupero della password.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

const run = `${String(Date.now())}${String(Math.floor(Math.random() * 1000))}`
const email = `e2e-${run}@example.com`
const username = `e2e_${run}`.slice(0, 20)
const password = `Una frase lunga per OP-Codex ${run}`
const newPassword = `Un'altra frase ancora più lunga ${run}`

/** La chiave di prova di Turnstile risolve il CAPTCHA da sola: si aspetta il token. */
async function waitForCaptcha(page: Page) {
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 20_000,
  })
}

async function login(page: Page, secret: string) {
  await page.goto('/accesso')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(secret)
  await waitForCaptcha(page)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `@${username}` })).toBeVisible()
}

async function logout(page: Page) {
  await page.getByRole('button', { name: 'Esci' }).click()
  await expect(page).toHaveURL(/\/accesso\?torna=%2Fprofilo$/)
}

test.describe.configure({ mode: 'serial' })

test('registrazione, conferma, Username, uscita e accesso', async ({ page }) => {
  // Senza account il profilo porta all'accesso.
  await page.goto('/profilo')
  await expect(page).toHaveURL(/\/accesso\?torna=%2Fprofilo$/)

  await page.getByRole('link', { name: 'Registrati' }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await waitForCaptcha(page)
  await page.getByRole('button', { name: 'Registrati' }).click()
  await expect(page.getByRole('heading', { name: 'Controlla la tua email' })).toBeVisible()

  const confirm = await linkFromEmail(email, /Conferma/, '/account/conferma')
  await page.goto(confirm)

  // Primo accesso: si sceglie lo Username.
  await expect(page.getByRole('heading', { name: 'Scegli il tuo Username' })).toBeVisible()
  await page.getByLabel('Username').fill(username)
  await page.getByRole('button', { name: 'Conferma' }).click()
  await expect(page.getByRole('heading', { level: 1, name: `@${username}` })).toBeVisible()

  await logout(page)
  await login(page, password)
})

test('password dimenticata: il link dell’email permette di sceglierne una nuova', async ({
  page,
}) => {
  await page.goto('/recupero-password')
  await page.getByLabel('Email').fill(email)
  await waitForCaptcha(page)
  await page.getByRole('button', { name: 'Mandami il link' }).click()
  await expect(page.getByRole('status')).toContainText('riceverai a breve')

  const reset = await linkFromEmail(email, /Reimposta/, '/account/conferma')
  await page.goto(reset)
  await expect(page.getByRole('heading', { name: 'Scegli una nuova password' })).toBeVisible()
  await page.getByLabel('Nuova password').fill(newPassword)
  await page.getByRole('button', { name: 'Salva la password' }).click()
  await expect(page.getByText('Password aggiornata.')).toBeVisible()

  await logout(page)
  await login(page, newPassword)
})

test('una password trapelata viene rifiutata in registrazione', async ({ page }) => {
  await page.goto('/registrazione')
  await page.getByLabel('Email').fill(`altro-${email}`)
  await page.getByLabel('Password', { exact: true }).fill('password12345')
  await page.getByRole('button', { name: 'Registrati' }).click()
  await expect(page.getByRole('alert')).toContainText('violazioni di dati note')
})

test.describe('il server applica le regole anche senza passare dall’app', () => {
  const signup = (body: object) =>
    fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  test('senza CAPTCHA registrazione e accesso falliscono', async () => {
    const noCaptcha = await signup({ email: `bot-${email}`, password })
    expect(noCaptcha.status).toBe(400)
    expect(((await noCaptcha.json()) as { error_code: string }).error_code).toBe('captcha_failed')

    const loginResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: newPassword }),
    })
    expect(loginResponse.status).toBe(400)
  })

  test('una password corta viene rifiutata', async () => {
    const response = await signup({
      email: `corta-${email}`,
      password: 'corta123',
      gotrue_meta_security: { captcha_token: 'XXXX.DUMMY.TOKEN.XXXX' },
    })
    expect(response.status).toBe(422)
    expect(((await response.json()) as { error_code: string }).error_code).toBe('weak_password')
  })
})
