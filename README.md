# OP-Codex

PWA per giocatori del One Piece Card Game: catalogo delle carte, collezione, deck builder, spiegazioni in italiano, prezzi e condivisione tra amici.

Stack: React + TypeScript + Vite (PWA con `vite-plugin-pwa`), Tailwind CSS + shadcn/ui, Supabase (Postgres, Auth, Edge Functions), hosting su Netlify.

Il dominio e le decisioni di progetto sono in [`CONTEXT.md`](CONTEXT.md) e [`docs/adr/`](docs/adr/).

## Requisiti

- [Node.js](https://nodejs.org/) 22 o superiore
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) avviato (serve al Supabase locale)
- [gitleaks](https://github.com/gitleaks/gitleaks): senza gitleaks il commit viene bloccato
  - Windows: `winget install Gitleaks.Gitleaks`
  - macOS: `brew install gitleaks`

## Avvio in locale

```sh
npm install              # installa le dipendenze e attiva l'hook pre-commit
npx supabase start       # avvia Supabase in Docker (la prima volta scarica le immagini)
npm run sync:set         # scarica OP-01 dalla Official Card List nel DB locale
npm run sync:images      # copia le immagini in WebP su Storage (lento: 3-8 s a immagine)
npm run dev              # app su http://localhost:5173
```

`npx supabase start` stampa gli URL e le chiavi del Supabase locale; lo Studio è su http://localhost:54323. Per fermarlo: `npx supabase stop`.

Le variabili d'ambiente sono documentate in [`.env.example`](.env.example): copia il file in `.env.local` (che git ignora) e inserisci i valori stampati da `npx supabase status` (`API_URL`, `PUBLISHABLE_KEY`, `SECRET_KEY`).

Per sincronizzare un altro Set passa il suo identificativo sul sito ufficiale, es. `npm run sync:set -- 569001` per ST-01 (gli identificativi sono i `value` del menu dei Set su https://en.onepiece-cardgame.com/cardlist/?series=569101).

Le immagini delle carte sono copie WebP su Supabase Storage ([ADR-0005](docs/adr/0005-immagini-dal-sito-ufficiale.md)): per ogni Printing una miniatura da 300 px e l'immagine completa da 600 px. `npm run sync:images` scarica solo quelle mancanti, al massimo `--limit` per esecuzione (default 200) con una pausa di `--delay-ms` tra le richieste (default 2000). Finché una Printing non ha l'immagine, la griglia mostra un segnaposto.

## Script

| Comando                                   | Cosa fa                                                   |
| ----------------------------------------- | --------------------------------------------------------- |
| `npm run dev`                             | Server di sviluppo                                        |
| `npm run build`                           | Typecheck e build di produzione in `dist/`                |
| `npm run preview`                         | Serve la build di produzione in locale                    |
| `npm test`                                | Tutti i test (unitari + database; serve Supabase avviato) |
| `npm run test:unit`                       | Solo i test unitari                                       |
| `npm run test:db`                         | Solo i test sul Supabase locale                           |
| `npm run sync:set -- <id>`                | Sync di un Set dalla Official Card List (default OP-01)   |
| `npm run sync:catalog`                    | Catalog Sync completo: tutti i Set del sito ufficiale     |
| `npm run sync:images -- --limit <n>`      | Image Sync delle immagini mancanti (default 200)          |
| `npm run db:types`                        | Rigenera i tipi TypeScript dallo schema del DB locale     |
| `npm run lint`                            | ESLint                                                    |
| `npm run typecheck`                       | TypeScript in modalità strict                             |
| `npm run format` / `npm run format:check` | Prettier                                                  |

## Database

Le migrazioni stanno in `supabase/migrations/`. Per crearne una: `npx supabase migration new <nome>`. Per riapplicarle da zero in locale: `npx supabase db reset`.

## Catalog Sync in produzione

Il workflow **Catalog Sync notturno** (`.github/workflows/catalog-sync.yml`) gira ogni notte alle 03:17 UTC e si può lanciare a mano da GitHub (Actions → Catalog Sync notturno → Run workflow):

1. `sync-catalog`: legge il menu dei Set, scarica le pagine una alla volta (3 s di pausa, fino a 3 tentativi) e salva tutto in un'unica transazione. Se una pagina non si legge, il job fallisce senza scrivere nulla.
2. `sync-images`: scarica un lotto di immagini mancanti (800 di default).

Ogni esecuzione è registrata nella tabella `job_runs`. I segreti (`SUPABASE_DB_URL`, `SUPABASE_SECRET_KEY`) stanno nell'environment `production` di GitHub, disponibile solo al branch `main`.

## Branch e deploy

- Si lavora su `dev`. Su `main` arriva solo il merge di funzionalità complete.
- Netlify pubblica solo `main` (vedi [ADR-0010](docs/adr/0010-deploy-solo-da-main.md)). La configurazione, header di sicurezza compresi, è in [`netlify.toml`](netlify.toml).

## Sicurezza

- Nessun segreto nel repo, che è pubblico. Gitleaks controlla ogni commit in locale e tutta la storia in CI.
- La CI su GitHub Actions esegue lint, typecheck, test (incluso il Supabase locale), build, `npm audit` e gitleaks. CodeQL e Dependabot sono attivi.
- Le action di GitHub sono fissate allo SHA del commit.
