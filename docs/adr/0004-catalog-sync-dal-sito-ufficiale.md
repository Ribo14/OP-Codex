# Catalog Sync dalla Official Card List, non da API della community

Il catalogo si alimenta leggendo ogni notte, con GitHub Actions, l'HTML della Official Card List (en.onepiece-cardgame.com). È la fonte di verità, è renderizzato lato server e ha una struttura regolare: Print ID con suffisso `_pN` per le parallel e `_rN` per le ristampe, e una sola richiesta (`/cardlist/?series=<id>`) restituisce tutte le carte di un Set. In più non ci lega a progetti di terzi che possono sparire.

## Considered Options

- **optcgapi.com / optcgjson / apitcg**: aggiornati ma senza licenza dichiarata e senza garanzie di continuità. optcgapi resta come controllo incrociato.

## Consequences

- Se Bandai cambia l'HTML, il Catalog Sync si rompe: il parser ha test su pagine salvate e il job segnala gli errori nell'area admin.
- Il Catalog Sync deve essere educato: poche richieste, sequenziali, con User-Agent identificabile.
