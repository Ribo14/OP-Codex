# PWA invece di app native

OP-Codex è una Progressive Web App installabile da browser su Android e iOS, non un'app pubblicata sugli store. Vogliamo distribuirla senza account sviluppatore, revisioni degli store e costi annuali, con un solo codice per telefono, tablet e desktop.

## Consequences

- Su computer OP-Codex si usa dal browser come un normale sito, senza installarlo: il desktop è una piattaforma di prima classe, con un layout per schermi larghi e l'uso completo con mouse e tastiera. L'installazione resta facoltativa e non viene proposta con inviti automatici.

- Su iOS l'installazione è manuale ("Condividi → Aggiungi alla schermata Home" da Safari): serve una schermata guida.
- Le notifiche push su iOS funzionano solo da iOS 16.4 e con l'app installata.
- Tutte le funzioni devono usare API web: fotocamera tramite `getUserMedia`, dati offline tramite service worker e IndexedDB.
