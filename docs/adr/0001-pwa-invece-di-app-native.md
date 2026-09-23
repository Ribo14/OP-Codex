# PWA invece di app native

OP-Codex è una Progressive Web App installabile da browser su Android e iOS, non un'app pubblicata sugli store. Vogliamo distribuirla senza account sviluppatore, revisioni degli store e costi annuali, con un solo codice per telefono, tablet e desktop.

## Consequences

- Su iOS l'installazione è manuale ("Condividi → Aggiungi alla schermata Home" da Safari): serve una schermata guida.
- Le notifiche push su iOS funzionano solo da iOS 16.4 e con l'app installata.
- Tutte le funzioni devono usare API web: fotocamera tramite `getUserMedia`, dati offline tramite service worker e IndexedDB.
