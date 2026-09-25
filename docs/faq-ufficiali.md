# FAQ ufficiali delle carte

Il dettaglio di una carta mostra le FAQ ufficiali di Bandai (RIB-44): domande e risposte in
inglese, con il PDF di origine. Vengono dai PDF di
[en.onepiece-cardgame.com/rules/faq](https://en.onepiece-cardgame.com/rules/faq/), salvati in
`docs/Regole One Piece Card/FAQ/`.

## Come arrivano nell'app

1. `scripts/faq/extract_faqs.py` legge i PDF con un'estrazione a tabella (pdfplumber) e scrive
   `catalog-sync/faq/faq-raw.json`: una voce per riga, testo così com'è nel PDF.
2. `catalog-sync/sync-faqs.ts` pulisce il testo, raggruppa per Card Code, toglie le domande ripetute
   tra un PDF e l'altro e salva nella tabella `card_faqs`, una riga per carta.
   - Il salvataggio è idempotente.
   - Una carta che non ha più FAQ resta con l'elenco vuoto.
   - Gira ogni notte nel workflow "Catalog Sync notturno" e si può lanciare anche a mano.
3. L'app scarica `card_faqs` insieme al catalogo, con lo stesso aggiornamento incrementale, e le
   tiene sul dispositivo: le FAQ si leggono anche offline.

## Quando Bandai pubblica nuove FAQ

1. Scarica il PDF nuovo (o aggiornato) in `docs/Regole One Piece Card/FAQ/`.
2. Rigenera il file delle FAQ:

   ```sh
   python -m venv .venv-faq
   .venv-faq/Scripts/python -m pip install -r scripts/faq/requirements.txt
   .venv-faq/Scripts/python scripts/faq/extract_faqs.py
   ```

   Su macOS e Linux il percorso è `.venv-faq/bin/python`.

3. Controlla il diff di `catalog-sync/faq/faq-raw.json` e lancia `npm run test:unit`.
4. Fai il merge su `main`. La notte dopo il Catalog Sync carica le FAQ in produzione. Il sito non
   si ripubblica, perché il file sta fuori dal frontend, quindi non si spendono crediti Netlify.
