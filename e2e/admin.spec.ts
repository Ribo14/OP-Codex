import { createHmac } from 'node:crypto'
import { expect, test, type Page } from '@playwright/test'
import postgres from 'postgres'
import { linkFromEmail } from './mailpit.ts'

// Area Admin (RIB-19) sul Supabase locale: il ruolo si assegna dal database come da
// docs/admin.md; senza verifica in due passaggi l'area invita ad attivarla, con il codice
// mostra lo stato dei job.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''
// Database del Supabase locale (lo stesso in CI): qui si fa ciò che l'Admin fa dalla dashboard.
const DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'

const run = crypto.randomUUID().replaceAll('-', '')
const email = `e2e-adm-${run}@example.com`
const username = `adm_${run}`.slice(0, 20)
const password = `Una frase lunga per l'Admin ${crypto.randomUUID()}`
/** Card Code di prova per la Ban List (non serve che esista nel catalogo). */
const testCode = `ZZ${String(Math.floor(Math.random() * 90) + 10)}-${String(Math.floor(Math.random() * 900) + 100)}`

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

async function login(page: Page) {
  await page.goto('/accesso?torna=%2Fadmin')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await expect(page.locator('input[name="cf-turnstile-response"]')).toHaveValue(/.+/, {
    timeout: 20_000,
  })
  await page.getByRole('button', { name: 'Accedi' }).click()
}

test('area Admin: ruolo dal database, verifica obbligatoria, stato dei job', async ({
  page,
  baseURL,
}) => {
  test.setTimeout(150_000)
  const sql = postgres(DB_URL, { max: 1, onnotice: () => undefined })
  let jobRunId: string | undefined
  try {
    // Account con Username.
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

    // Senza ruolo: area riservata.
    await page.goto('/admin')
    await expect(page.getByText('Questa area è riservata agli amministratori.')).toBeVisible()

    // Ruolo assegnato come in docs/admin.md, con la riga nel registro.
    const granted = await sql`
      with u as (
        update auth.users
        set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"admin": true}'
        where email = ${email}
        returning id, email
      )
      insert into public.admin_audit_log (action, table_name, record_id, after)
      select 'grant_admin', 'auth.users', id::text, jsonb_build_object('email', email, 'admin', true)
      from u
      returning id
    `
    expect(granted).toHaveLength(1)
    const [jobRun] = await sql<{ id: string }[]>`
      insert into public.job_runs (job, status, started_at, finished_at, stats)
      values ('catalog_sync', 'success', now() - interval '200 seconds', now(),
              '{"pages": 60, "catalog": {"cards": 2785}}')
      returning id
    `
    jobRunId = jobRun?.id

    // Admin senza verifica in due passaggi: invito ad attivarla.
    await page.reload()
    await expect(page.getByText(/serve la verifica in due passaggi/)).toBeVisible()
    await page.getByRole('link', { name: 'Vai al Profilo' }).click()
    await page.getByRole('button', { name: 'Attiva' }).click()
    const secret = (await page.locator('code').innerText()).trim()
    const enrolledAt = currentStep()
    await page.getByLabel("Codice dell'app").fill(totp(secret, enrolledAt))
    await page.getByRole('button', { name: 'Conferma e attiva' }).click()
    await expect(page.getByText('Verifica in due passaggi attivata.')).toBeVisible()

    // Con il codice l'area mostra lo stato dei job.
    await page.goto('/admin')
    await expect(page.getByRole('heading', { name: 'Stato dei job' })).toBeVisible()
    await expect(page.getByText('Catalog Sync').first()).toBeVisible()
    await expect(page.getByText('3 min 20 s').first()).toBeVisible()

    // Ban List (RIB-29): le voci ufficiali ci sono; l'Admin aggiunge una voce, poi la elimina.
    await expect(page.getByRole('heading', { name: 'Ban List' })).toBeVisible()
    await expect(page.getByText(/^OP06-047 ·/)).toBeVisible()
    await page.getByRole('button', { name: 'Aggiungi' }).click()
    await page.getByLabel('Carta (Card Code)').fill(testCode)
    await page.getByLabel('Tipo').selectOption('restricted')
    await page.getByLabel('Copie consentite').fill('1')
    await page.getByLabel('In vigore dal').fill('2026-10-01')
    await page.getByLabel(/^Fonte/).fill('E2E')
    await page.getByRole('button', { name: 'Salva' }).click()
    await expect(page.getByText(new RegExp(`^${testCode} ·`))).toBeVisible()
    const logged = await sql<{ action: string }[]>`
      select action from public.admin_audit_log
      where table_name = 'public.ban_list_entries' and after ->> 'card_code' = ${testCode}
    `
    expect(logged.map((r) => r.action)).toEqual(['insert'])
    await page.getByRole('button', { name: `Elimina ${testCode}` }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Elimina' }).click()
    await expect(page.getByText(new RegExp(`^${testCode} ·`))).toHaveCount(0)

    // Nuovo accesso: prima il codice, poi di nuovo l'area.
    await page.goto('/profilo')
    await page.getByRole('button', { name: 'Esci', exact: true }).click()
    await login(page)
    await expect(page).toHaveURL(/\/account\/codice\?torna=%2Fadmin$/)
    await expect
      .poll(currentStep, { timeout: 35_000, intervals: [1000] })
      .toBeGreaterThan(enrolledAt)
    await page.getByLabel("Codice dell'app").fill(totp(secret, currentStep()))
    await page.getByRole('button', { name: 'Verifica' }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByRole('heading', { name: 'Stato dei job' })).toBeVisible()
    // Col ruolo nel token compare anche la voce nelle Impostazioni.
    await page.goto('/impostazioni')
    await expect(page.getByRole('link', { name: 'Area Admin' })).toBeVisible()
  } finally {
    // L'account di prova si elimina; il registro, per costruzione, resta.
    await sql`delete from auth.users where email = ${email}`
    if (jobRunId) await sql`delete from public.job_runs where id = ${jobRunId}`
    await sql.end()
  }
})
