# Anteprime dei Set non ancora usciti da OPTCG Leaks

Le carte dei Set annunciati ma non ancora nella Official Card List arrivano da OPTCG Leaks (`https://optcgleaks.com`) come **anteprime**: si vedono nel catalogo con l'etichetta "Anteprima" e la fonte, si possono mettere in un mazzo (con un Deck Warning) ma non in una Collection. Quando la Official Card List pubblica la stessa Card, il Catalog Sync la sostituisce con i dati ufficiali. La fonte di verità resta la Official Card List (ADR-0004).

## Context

Bandai pubblica l'elenco ufficiale delle carte di un Set solo intorno all'uscita (EB-05 esce il 30 ottobre 2026 e il 12 ottobre non era ancora nell'elenco, né in inglese né in giapponese). I giocatori vogliono vedere le carte rivelate prima, per preparare i mazzi.

## Considered Options

- **Car D. Kaizoku** (`cardkaizoku.com/spoilers`): dati completi, ma i Terms of Service vietano di riprodurre o distribuire i contenuti senza permesso scritto; il sito è dietro la protezione anti-bot di Cloudflare. Scartato.
- **Anteprime inserite a mano dall'area Admin**: nessun problema con terzi, ma richiede lavoro a ogni spoiler. Resta un'alternativa se OPTCG Leaks sparisse.
- **OPTCG Leaks**: un file JSON pubblico per Set (`images.optcgleaks.com/<set>/<set>.json`) con carte tradotte in inglese e immagini; robots.txt permette tutto e il sito non ha condizioni d'uso. Scelto.

## Consequences

- **Preview Sync** (`catalog-sync/preview-sync.ts`, job `preview_sync`), ogni notte dopo il Catalog Sync. Trova da solo i Set nuovi: per ogni serie (OP, EB, ST, PRB) prova i 4 numeri dopo l'ultimo Set ufficiale (es. OP-18…OP-21); un 403 vuol dire che il sito non ha quel Set. Nessun elenco da aggiornare a mano. Un Set che non risponde si salta; se il sito è giù la notte va avanti lo stesso.
- Si prendono solo le carte nuove (`cards`); le varianti nuove di carte già uscite (`sp_cards`) e le carte senza codice no. Una Card già ufficiale non diventa mai anteprima, e un Set già ufficiale non si tocca.
- Nel database: `preview` su `sets`, `cards` e `printings`, `cards.preview_credit` (chi ha tradotto, da citare) e `printings.preview_image` (se il sito cambia immagine, si riscarica). I Set in anteprima hanno `series_id` negativo. Il Block non c'è: nessun limite di formato finché non arriva quello ufficiale.
- Un trigger su `collection_entries` impedisce di aggiungere una Printing in anteprima alla Collection, qualunque sia la strada.
- Uscita: prima dell'upsert ufficiale, `retirePreviews` cancella le Printing in anteprima delle Card ora ufficiali (i mazzi che le mostravano tornano alla stampa base; il conteggio per Card Code non cambia) e libera il codice del Set in anteprima. La Card viene sovrascritta dai dati ufficiali.
- Le immagini delle anteprime stanno su Storage sotto `card-images/preview/`: la Printing ufficiale con lo stesso Print ID ha un altro URL, quindi nessuna cache mostra l'immagine vecchia. Le anteprime non vanno nella cache offline.
- La copia locale dell'app non cancella righe: `buildCatalog` scarta le Printing in anteprima di Card ormai ufficiali e i Set in anteprima rimasti vuoti.
- Il rischio sui diritti delle immagini è lo stesso delle immagini ufficiali (ADR-0005); i testi sono traduzioni di fan, non ufficiali, e lo diciamo nel dettaglio della carta.
