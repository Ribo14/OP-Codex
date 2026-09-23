# Prezzi Cardmarket dai file pubblici del price guide, non dall'API

Cardmarket non accetta nuove richieste di accesso API (verificato a settembre 2026). Leggiamo quindi ogni notte i file JSON pubblici del price guide e del catalogo prodotti (gioco 18 = One Piece). CardTrader invece si usa tramite la sua API ufficiale con token.

## Consequences

- Cardmarket dà lo stesso nome a tutte le Printing di una Card: il Price Mapping è euristico (ordine di `idProduct` e data di aggiunta, incrociato con i `card_market_ids` dei blueprint CardTrader) e servono i Mapping Override manuali.
- I termini d'uso di quei file non sono documentati: se Cardmarket li rimuove o li vieta, la fonte va sostituita.
