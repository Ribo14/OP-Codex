# Piano delle fasi 4 (Scanner) e 5 (Prezzi)

Divisione in slice delle issue ombrello RIB-31 (fase 4) e RIB-32 (fase 5), decisa il 2026-09-27.
Le slice diventeranno issue su Linear appena il servizio torna disponibile; fino ad allora il
riferimento è questo file. Terminologia in `CONTEXT.md`, decisione sulla fonte dei prezzi in
ADR-0008.

## Decisioni prese (2026-09-27)

1. Slice scritte qui, issue su Linear più tardi; il lavoro procede su `dev`.
2. Si parte in parallelo da Prezzi Cardmarket e dallo Scan Recognizer; lo scanner con la
   fotocamera aspetta la prova su carte reali (almeno 30, anche foil) fatta dall'utente.
3. Storico dei prezzi: un Price Snapshot al giorno conservato per 90 giorni, poi uno a
   settimana (il lunedì). Lo storico parte dal primo Price Sync.
4. L'ultimo prezzo di ogni Printing arriva con il catalogo sul dispositivo (anche offline);
   il grafico dell'andamento si carica online all'apertura della carta.
5. CardTrader in una slice separata, quando l'utente avrà creato il token dell'API.
6. OCR con Tesseract.js sul dispositivo, caricato solo all'apertura dello scanner.

## Verifica preliminare (RIB-32)

Il 2026-09-27 i file pubblici di Cardmarket (gioco 18) sono disponibili e nel formato atteso:

- `productCatalog/priceGuide/price_guide_18.json`: `idProduct`, `trend`, `low`, `avg`,
  `avg1`/`avg7`/`avg30` e le stesse voci `-foil`.
- `productCatalog/productList/products_singles_18.json`: `idProduct`, `name`
  (es. `Roronoa Zoro (OP01-001)`), `idExpansion`, `idMetacard`, `dateAdded`.
- `productCatalog/productList/products_nonsingles_18.json`: prodotti sigillati; dal nome si
  capisce se un'espansione è inglese o no (`(Non-English)`, `(Asia Region Legal)`).

Prova dell'abbinamento sui dati di produzione (4.843 Printing, 12.573 prodotti):

- ogni Set esiste su Cardmarket due volte, in inglese e non: le espansioni non inglesi si
  scartano;
- per ogni Set si sceglie l'espansione inglese che contiene più Card Code del Set;
- 4.338 Printing (90%) hanno tanti prodotti quante Printing nell'espansione scelta: si
  abbinano in ordine (la base al prodotto più economico, le parallele per `idProduct`);
- il resto (soprattutto Promo, "OTHER" e Starter Deck con ristampe) resta senza prezzo finché
  un Admin non imposta un Mapping Override.

## Stato (2026-09-27)

- Fatte su `dev`: 5.1 (prezzi nel dettaglio Card, Price Sync notturno), 5.2 (abbinamenti
  dall'area Admin), 5.3 (grafico dell'andamento), 5.4 (valore di Collection e Deck; solo le
  copie inglesi, le altre lingue contate a parte), 4.1 (Scan Recognizer), 4.3 (pagina Scanner,
  con prezzo sotto ogni stampa e il testo letto dall'OCR in fondo per la prova 4.2), 4.4 (Burst
  Scan: "Aggiungi alla collezione", +1 sulla stampa giusta, lingua a scelta).
- 5.5 (CardTrader) scritta e testata con un'API finta: gioco 15, carte singole categoria 192,
  abbinamento tramite i `card_market_ids` dei blueprint, minimo in euro delle offerte inglesi
  Near Mint o Mint non gradate. Job `cardtrader_sync` dopo il Price Sync; senza il segreto
  `CARDTRADER_TOKEN` si salta. Da provare con il token vero.
- Resta: 4.2 (prova su almeno 30 carte reali, la fa l'utente).
- Prova su 16 immagini ufficiali (non foto): codice letto in 14. Le due mancate hanno il
  codice in giallo su illustrazioni molto colorate (OP01-120, OP13-118 SEC).
- Test E2E dello Scanner con la fotocamera finta di Chromium e una carta disegnata da noi
  (`e2e/fixtures/make-scanner-video.mjs`).

## Fase 5: Prezzi

### 5.1 Price Sync Cardmarket e prezzo nel dettaglio Card (AFK)

- Modulo puro **Price Mapper** (`catalog-sync/price-mapper.ts`) con test su fixture.
- Migrazione: `cardmarket_products`, `price_mappings`, `mapping_overrides`,
  `price_snapshots` (storico), `printing_prices` (ultimo prezzo, letto dall'app).
- Job notturno `sync-prices.ts` nel workflow del Catalog Sync, registrato in `job_runs`
  (`price_sync`), con la pulizia dello storico (90 giorni, poi settimanale).
- App: prezzo trend e minimo in euro nel dettaglio Card, data dell'aggiornamento e link a
  Cardmarket; il prezzo viaggia con il catalogo locale (offline).
- Criteri: test del Price Mapper (varianti con lo stesso nome, espansioni non inglesi,
  override che prevalgono sempre); test RLS delle nuove tabelle; job idempotente.

### 5.2 Mapping Override dall'area Admin (AFK)

- Sezione Admin: le Printing senza abbinamento o "da verificare", i prodotti candidati
  (stesso Card Code) con prezzo, scelta del prodotto o "nessun prodotto"; registro delle
  azioni Admin. User story 77.

### 5.3 Grafico dell'andamento (AFK)

- Piccolo grafico nel dettaglio Card dagli ultimi Price Snapshot, solo online. User story 62.

### 5.4 Valore di Collection e Deck (AFK)

- Valore stimato della Collection e di un Deck (Printing mostrata, altrimenti la base).
  User story 63 e 64.

### 5.5 Prezzi CardTrader (HITL: token)

- L'utente crea il token dell'API CardTrader; poi minimo disponibile in euro e abbinamento
  incrociato tramite `card_market_ids` dei blueprint.

## Fase 4: Scanner

### 4.1 Scan Recognizer (AFK)

- Modulo puro `src/scanner/scan-recognizer.ts`: testo OCR grezzo → Card Code normalizzato
  (`(OP|ST|EB|PRB|P)\d{0,2}-\d{3}` più la correzione degli errori tipici dell'OCR, O↔0, I↔1,
  S↔5, B↔8) → Card e Printing candidate del catalogo. Test su una tabella di testi realistici.

### 4.2 Spike OCR su carte reali (HITL)

- Pagina di prova con fotocamera e Tesseract.js; l'utente prova almeno 30 carte (normali e
  foil) e annota quante vengono lette. Decide se l'OCR basta o serve altro.

### 4.3 Scan (AFK dopo 4.2)

- Pulsante Scanner, fotocamera (`getUserMedia`, anche nella PWA installata su iOS e Android),
  ritaglio della zona in basso a destra, scelta della Printing tra le miniature, correzione
  manuale del codice, apertura del dettaglio con prezzo. User story 54–56, 58, 59.
- `Permissions-Policy` consente già la fotocamera al nostro dominio (`camera=(self)`).

### 4.4 Burst Scan verso la Collection (AFK)

- Scansioni in sequenza senza chiudere la fotocamera, conferma rapida di Printing e quantità.
  User story 57.
