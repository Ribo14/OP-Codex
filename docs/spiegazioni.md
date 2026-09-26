# Spiegazioni delle carte (Card Explanation)

Le spiegazioni in italiano delle carte si scrivono in anticipo, nelle sessioni di sviluppo con Claude, e si rivedono prima del commit. L'app non chiama mai un modello AI (ADR-0006): costo zero.

## Dove stanno

- `catalog-sync/explanations/*.json`, un file per Set o gruppo (`op01.json` … `op17.json`, `eb.json`, `st.json`, `promo.json`).
- Ogni voce: `{ "cardCode": "OP01-001", "body": "..." }`, una per Card (non per Printing).
- Il job notturno `catalog-sync.yml` (passo "Explanation Sync") le carica nella tabella `card_explanations`; da lì arrivano nella copia del catalogo sul dispositivo, anche offline. Per caricarle subito: lanciare a mano il workflow, oppure `node catalog-sync/sync-explanations.ts` con `SUPABASE_DB_URL`.
- Una spiegazione tolta dal file resta nel database con il testo vuoto e sparisce dall'app.

## Controlli

- `node catalog-sync/sync-explanations.ts --check` controlla i file senza database: Card Code validi e non ripetuti, testo non vuoto, massimo 4000 caratteri.
- Lo stesso controllo gira nei test (`catalog-sync/explanation-sync.test.ts`), quindi in CI.

## Come si scrivono

- Italiano semplice, frasi brevi. I termini di gioco restano in inglese come sulle carte (Character, Leader, DON!!, Main Phase), con "Vita", "cestino", "a riposo" e "attivo" come nel glossario (`src/rules/glossary.ts`).
- Prima cosa fa l'effetto, poi quando conviene usarlo e gli errori comuni. Due o tre paragrafi al massimo.
- Solo quello che dicono il testo ufficiale, le FAQ della carta (`catalog-sync/faq/faq-raw.json`) e il regolamento. Niente strategie inventate né giudizi sul metagame.
- Markdown semplice: paragrafi separati da una riga vuota, elenchi con `- `, grassetto con `**testo**`. Le Keyword tra parentesi quadre (`[Blocker]`, `[DON!! x1]`) diventano link al glossario.
- Nomi di carte e tipi come sulle carte: `[Trafalgar Law]`, `{Straw Hat Crew}`.

## Segnalazioni e richieste degli utenti (RIB-54)

- Nel dettaglio di una carta, chi ha l'accesso può **segnalare** una spiegazione (sbagliata, poco chiara, altro, con una nota) o **chiedere** la spiegazione di una carta con effetto che non ce l'ha. Al massimo 10 al giorno, una voce aperta per carta e tipo; le voci sono nell'export dei dati personali.
- L'Admin le vede in **Area Admin → Segnalazioni e richieste**, raggruppate per carta, e può copiarne l'elenco.
- In sessione: `node catalog-sync/explanation-queue.ts` (con `SUPABASE_DB_URL` per la produzione) stampa la coda; scritte o corrette le spiegazioni, `node catalog-sync/explanation-queue.ts --resolve OP01-001,OP02-003` segna risolte le voci di quelle carte. Oppure dall'area Admin (Risolta / Scarta), con ogni cambio nel registro delle azioni.

## Stato

- 2026-09-26: tutti i 142 Leader (RIB-52). Prossimo: le carte con effetto dei Set legali in Standard, a blocchi (RIB-55), e le richieste degli utenti dalla coda Admin (RIB-54).
