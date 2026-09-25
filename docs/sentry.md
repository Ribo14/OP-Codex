# Segnalazione degli errori (Sentry)

Gli errori dell'app arrivano a [Sentry](https://sentry.io) (piano gratuito, server in UE), senza
dati personali (RIB-35). Il codice è in `src/lib/error-reporting.ts`.

## Cosa si invia e cosa no

- **Si invia**: messaggio e tipo dell'errore, pila delle chiamate, pagina (solo il percorso),
  browser e sistema operativo.
- **Non si invia**:
  - utente, email, IP, cookie, intestazioni, query string;
  - breadcrumb, cioè clic, testi, console e richieste;
  - variabili locali, sessioni e pagine viste;
  - tracing e replay.
- I token degli Share Link (`/m/<token>`) e gli id dei Deck negli indirizzi diventano segnaposto
  (`/m/:token`, `:id`).
- Senza `VITE_SENTRY_DSN` Sentry è spento e la sua libreria non viene nemmeno caricata.

Le source map (per leggere la pila delle chiamate con il codice originale) si caricano su Sentry
durante la build di Netlify e poi si cancellano: non vengono mai pubblicate sul sito.

## Configurazione

- `VITE_SENTRY_DSN`, `SENTRY_ORG` e `SENTRY_PROJECT` (tutti pubblici) stanno in `netlify.toml`.
  L'organizzazione è `op-codex` e il progetto `op-codex`, con i dati in UE.
- `SENTRY_AUTH_TOKEN` (Organization Token di Sentry, serve solo a caricare le source map) è un
  **segreto**: sta nelle variabili d'ambiente di Netlify, marcato "Contains secret values".
- La CSP consente solo l'indirizzo di invio del progetto (`o4512148413874176.ingest.de.sentry.io`).
- Nel progetto Sentry è attivo "Prevent Storing of IP Addresses", con i Data Scrubber predefiniti.

In locale Sentry resta spento: `VITE_SENTRY_DSN` è vuota in `.env.local`.

## Verifica senza dati personali

**2026-09-25**: build locale con il DSN, errore di prova su `/m/<token>?utente=<email>`. L'evento
arrivato a Sentry contiene tipo e messaggio dell'errore, pila delle chiamate, `request.url` uguale a
`/m/:token` (senza token né query), lingua e fuso orario del browser, `infer_ip: "never"`. Nessun
utente, IP, intestazione o breadcrumb.

Per ripeterla in produzione: apri il sito, poi la console del browser, e scrivi
`setTimeout(() => { throw new Error('Prova Sentry') })`. L'errore compare su Sentry entro un minuto.
