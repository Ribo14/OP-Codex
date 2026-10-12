# Prezzi Cardmarket dai file pubblici del price guide, non dall'API

Cardmarket non accetta nuove richieste di accesso API (verificato a settembre 2026). Leggiamo quindi ogni notte i file JSON pubblici del price guide e del catalogo prodotti (gioco 18 = One Piece). CardTrader invece si usa tramite la sua API ufficiale con token.

## Consequences

- Cardmarket dà lo stesso nome a tutte le Printing di una Card: il Price Mapping è euristico (ordine di `idProduct` e data di aggiunta, incrociato con i `card_market_ids` dei blueprint CardTrader) e servono i Mapping Override manuali.
- I termini d'uso di quei file non sono documentati: se Cardmarket li rimuove o li vieta, la fonte va sostituita.
- RIB-96 (ottobre 2026): le regole sono in `catalog-sync/price-mapper.ts`. Oltre all'abbinamento in ordine quando prodotti e Printing sono tanti quanti, una Card che nel Set ha solo la base prende il prodotto più economico uscito il primo giorno, nell'espansione inglese con più carte della sua serie (negli Starter Deck Cardmarket ha anche la "Super PreRelease" timbrata, le Promo hanno versioni speciali in altre espansioni). Una ristampa `_rN` senza prodotto suo prende quello della base. Gli Starter Deck e i Set futuri si abbinano così da soli; restano a mano soprattutto le Promo con più versioni.
