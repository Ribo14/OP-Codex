// Carica nel database la composizione degli Starter Deck (catalog-sync/decks/starter-decks.json).
// Uso: node catalog-sync/sync-recipes.ts   (SUPABASE_DB_URL per la produzione, altrimenti il locale)

import { readFile } from 'node:fs/promises'
import { connect, finishJobRun, startJobRun } from './catalog-store.ts'
import { checkRecipes, upsertRecipes, type RecipeFile } from './recipe-sync.ts'

const FILE = new URL('./decks/starter-decks.json', import.meta.url)

async function main(): Promise<void> {
  const file = JSON.parse(await readFile(FILE, 'utf8')) as unknown
  const sql = connect()
  try {
    const runId = await startJobRun(sql, 'recipe_sync')
    try {
      const problems = checkRecipes(file)
      if (problems.length > 0) throw new Error(`File non valido: ${problems.join('; ')}`)
      const stats = await sql.begin((tx) => upsertRecipes(tx, file as RecipeFile))
      await finishJobRun(sql, runId, { status: 'success', stats })
      console.log(
        `Composizioni caricate: ${String(stats.decks)} mazzi (nuovi ${String(stats.inserted)}, ` +
          `aggiornati ${String(stats.updated)}, tolti ${String(stats.removed)})`,
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      await finishJobRun(sql, runId, { status: 'error', stats: {}, error: message })
      throw error
    }
  } finally {
    await sql.end()
  }
}

main().catch((error: unknown) => {
  console.error(
    'Caricamento delle composizioni fallito:',
    error instanceof Error ? error.message : error,
  )
  process.exitCode = 1
})
