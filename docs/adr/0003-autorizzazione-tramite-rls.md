# Autorizzazione tramite Row Level Security, frontend collegato direttamente al database

Il frontend legge e scrive direttamente su Supabase con la chiave pubblica, senza un'API backend intermedia. Tutta l'autorizzazione è quindi affidata alla Row Level Security di Postgres: ogni tabella ha RLS attiva con negazione di default, e ogni policy ha un test automatico. Le Edge Functions si usano solo dove servono segreti o logica costosa: AI, prezzi, operazioni admin.

## Consequences

- Una policy sbagliata espone dati: i test delle policy girano in CI a ogni push e sono bloccanti.
- Il ruolo Admin sta in `app_metadata`, che l'utente non può modificare, mai in `user_metadata`.
- La chiave `service_role` non deve mai arrivare al frontend né al repo, che è pubblico.
