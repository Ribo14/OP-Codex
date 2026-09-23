# OP-Codex

PWA per giocatori del One Piece Card Game: catalogo delle carte, collezione, deck builder, spiegazioni in italiano di effetti e regolamento, prezzi di mercato e condivisione tra amici.

I termini canonici sono in inglese (si usano così nel codice e nelle issue); la glossa italiana è l'etichetta da usare nell'interfaccia.

## Catalogo

**Card** (Carta):
Una carta del gioco intesa come regole: stesso nome, effetti e statistiche. È identificata dal suo Card Code.
_Avoid_: card come stampa fisica (quella è una Printing)

**Card Code** (Codice):
Il codice stampato in basso a destra sulla carta, es. `OP01-001`. Identifica una Card, non una Printing.
_Avoid_: card number, ID, collector number

**Printing** (Variante):
Una specifica stampa di una Card: la base, una parallel/alt-art o una ristampa in un altro Set. È identificata dal Print ID.
_Avoid_: variant, version, edizione

**Print ID**:
L'identificativo della Printing usato dal sito ufficiale: il Card Code più un eventuale suffisso, `_pN` per le parallel/alt-art (es. `OP01-001_p1`) o `_rN` per le ristampe in un altro Set (es. `OP01-006_r1`). La Printing base non ha suffisso.

**Set**:
Il prodotto in cui una Printing è stata pubblicata, es. OP-01, ST-10, EB-02, PRB-01, Promo.
_Avoid_: series, espansione, booster (per indicare il set)

**Category** (Categoria):
Il tipo di carta secondo le regole: Leader, Character, Event, Stage, DON!!.
_Avoid_: card type

**Type** (Tipo):
Una delle "feature" che classificano una Card, es. "Straw Hat Crew". Una Card può averne più di una.
_Avoid_: tag, trait, tribe

**Block** (Blocco):
Il numero di blocco stampato sulla carta che determina in quale rotazione è legale.

**Official Card List**:
L'elenco delle carte sul sito ufficiale inglese di Bandai: è la fonte di verità del catalogo.

**Catalog Sync**:
L'aggiornamento periodico del catalogo a partire dalla Official Card List.
_Avoid_: scraping (come nome del concetto), import

## Regole e spiegazioni

**Comprehensive Rules** (Regolamento completo):
Il regolamento ufficiale completo in inglese; è la fonte citata dalle risposte sul regolamento.

**Keyword** (Parola chiave):
Un termine di regola con significato fisso che compare negli effetti, es. Blocker, Rush, Trigger, Counter, DON!! ×1.
_Avoid_: ability (per le parole chiave)

**Glossary Entry** (Voce del glossario):
La spiegazione in italiano di una Keyword o di un concetto di regola, consultabile offline.

**Card Explanation** (Spiegazione):
Il testo in italiano che spiega come e quando usare gli effetti di una Card. Ne esiste una per Card, non per Printing.
_Avoid_: traduzione (non è una traduzione del testo ufficiale)

**Explanation Report** (Segnalazione):
La segnalazione di un utente che una Card Explanation è sbagliata o poco chiara.

**Rules Question** (Domanda sul regolamento):
Una domanda in linguaggio naturale posta alla chat del regolamento, che risponde citando le Comprehensive Rules.

## Mazzi

**Deck** (Mazzo):
Un Leader più 50 carte, di proprietà di un User. Le carte si contano per Card Code, ma per ognuna si può scegliere quale Printing mostrare.
_Avoid_: decklist (per il mazzo salvato)

**Deck List** (Lista):
La rappresentazione testuale di un Deck nel formato `4xOP01-016`, usata per import, export e copia.

**Deck Warning** (Avviso):
Una violazione delle regole di costruzione trovata in un Deck. Non impedisce di salvarlo.
_Avoid_: errore, deck invalido

**Ban List** (Lista carte bandite/limitate):
L'elenco corrente delle Card bandite o limitate nel numero di copie, gestito da un Admin.

**Visibility** (Visibilità):
Chi può vedere un Deck (Private, Friends, Public Link) o una Collection (Private, Friends).

**Share Link** (Link di condivisione):
Un link con un codice casuale e revocabile che rende un Deck visibile a chiunque lo abbia.

## Collezione

**Collection** (Collezione):
L'insieme delle Collection Entry di un User.

**Collection Entry**:
Quante copie di una Printing possiede un User, con la lingua di stampa facoltativa (predefinita EN).

**Set Completion** (Completamento set):
Quante Card distinte di un Set un User possiede rispetto al totale.

**Missing Cards** (Carte mancanti):
Le carte di un Deck che mancano nella Collection del suo proprietario.

## Scanner

**Scan**:
Riconoscere una carta fisica dalla fotocamera leggendo il Card Code; se il Card Code ha più Printing, l'utente sceglie quella giusta.

**Burst Scan** (Scansione a raffica):
Una sequenza di Scan senza chiudere la fotocamera, per registrare velocemente la Collection.

## Prezzi

**Marketplace**:
Un sito di compravendita da cui leggiamo i prezzi: Cardmarket o CardTrader.

**Price Snapshot** (Prezzo):
Il prezzo di una Printing su un Marketplace in una certa data.

**Price Mapping** (Abbinamento prezzo):
Il collegamento tra una Printing e il prodotto corrispondente su un Marketplace.

**Mapping Override** (Correzione abbinamento):
Un Price Mapping impostato a mano da un Admin, che prevale su quello automatico.

## Persone

**User** (Utente):
Una persona registrata, identificata pubblicamente dal suo Username.
_Avoid_: account, player (per l'utente dell'app)

**Username** (Nome utente):
L'identificativo pubblico e univoco di un User, es. `@ribo`.

**Friend Request** (Richiesta di amicizia):
Una richiesta da un User a un altro, in attesa di essere accettata o rifiutata.

**Friendship** (Amicizia):
Il legame reciproco tra due User, nato da una Friend Request accettata.

**User Block** (Blocco utente):
Il divieto posto da un User a un altro di cercarlo o di inviargli Friend Request.
_Avoid_: Block (riservato al Block di rotazione), ban (riservato alla Ban List)

**Admin**:
Un User con i permessi di gestire Card Explanation, Explanation Report, Ban List e Mapping Override.

## Simulatore

**Playtest Table** (Tavolo di prova):
Un tavolo virtuale in cui si muovono le carte a mano per provare un Deck. Non applica automaticamente gli effetti delle carte.
_Avoid_: simulatore, engine
