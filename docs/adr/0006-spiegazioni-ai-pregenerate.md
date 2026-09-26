# Card Explanation scritte in anticipo nelle sessioni di sviluppo, a costo zero

Le Card Explanation in italiano si scrivono in anticipo e si salvano: l'app non chiama mai un modello AI. Le scrive Claude nelle sessioni di sviluppo con Claude Code (l'abbonamento personale dell'Admin), a blocchi, partendo da testo ufficiale, FAQ e Comprehensive Rules. Finiscono in un file JSON nel repo, come le FAQ ufficiali, e da lì nel database e nella copia offline del catalogo. Una per Card, non per Printing, perché le Printing condividono il testo.

Prima versione (2026-09-22): generazione automatica dal Catalog Sync con Claude Sonnet 5 tramite API. Cambiata il 2026-09-26: l'app la usano solo l'Admin e i suoi amici, senza entrate, e il budget per l'AI è €0. L'abbonamento a Claude vale per l'uso personale e non può alimentare le chiamate di un'app; le API si pagano a parte.

## Consequences

- Costo zero; la lettura è istantanea e funziona offline.
- Le Card Explanation si aggiornano solo durante le sessioni: le Card nuove restano senza finché non se ne scrive il blocco. Si parte da Leader e Card dei Set legali nel formato Standard; le Card senza effetto non ne hanno bisogno.
- Explanation Report e richieste di spiegazione degli utenti finiscono nella coda Admin e si evadono nella sessione successiva.
- Il testo passa da una revisione umana (l'Admin), che è anche la difesa contro gli errori sulle regole.
- Se un giorno ci fosse un budget, si può tornare alla generazione automatica via API senza cambiare il formato dei dati.
