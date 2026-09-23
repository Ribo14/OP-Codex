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
npm run dev              # app su http://localhost:5173
```

`npx supabase start` stampa gli URL e le chiavi del Supabase locale; lo Studio è su http://localhost:54323. Per fermarlo: `npx supabase stop`.

Le variabili d'ambiente sono documentate in [`.env.example`](.env.example): copia il file in `.env.local` (che git ignora) e inserisci `API_URL` e `PUBLISHABLE_KEY` stampati da `npx supabase status`.

Per sincronizzare un altro Set passa il suo identificativo sul sito ufficiale, es. `npm run sync:set -- 569001` per ST-01 (gli identificativi sono i `value` del menu dei Set su https://en.onepiece-cardgame.com/cardlist/?series=569101).

In sviluppo le immagini delle carte passano dal proxy di Vite (`/card-images/…`): il sito ufficiale non consente di mostrarle direttamente su un altro dominio.

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
| `npm run db:types`                        | Rigenera i tipi TypeScript dallo schema del DB locale     |
| `npm run lint`                            | ESLint                                                    |
| `npm run typecheck`                       | TypeScript in modalità strict                             |
| `npm run format` / `npm run format:check` | Prettier                                                  |

## Database

Le migrazioni stanno in `supabase/migrations/`. Per crearne una: `npx supabase migration new <nome>`. Per riapplicarle da zero in locale: `npx supabase db reset`.

## Branch e deploy

- Si lavora su `dev`. Su `main` arriva solo il merge di funzionalità complete.
- Netlify pubblica solo `main` (vedi [ADR-0010](docs/adr/0010-deploy-solo-da-main.md)). La configurazione, header di sicurezza compresi, è in [`netlify.toml`](netlify.toml).

## Sicurezza

- Nessun segreto nel repo, che è pubblico. Gitleaks controlla ogni commit in locale e tutta la storia in CI.
- La CI su GitHub Actions esegue lint, typecheck, test (incluso il Supabase locale), build, `npm audit` e gitleaks. CodeQL e Dependabot sono attivi.
- Le action di GitHub sono fissate allo SHA del commit.
