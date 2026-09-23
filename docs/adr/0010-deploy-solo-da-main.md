# Deploy in produzione solo al merge su main, preview solo per le Pull Request

Il piano gratuito di Netlify ha 300 crediti al mese e ogni deploy di produzione ne costa 15, cioè circa 20 deploy al mese. Lo sviluppo avviene quindi sul branch `dev` e su `main` arriva solo un merge per ogni funzionalità completata, tramite Pull Request con la CI verde (branch protection).

I deploy preview e i branch deploy non consumano crediti (verificato sulla documentazione Netlify il 2026-09-23). Attiviamo quindi i deploy preview per le Pull Request verso `main`, per provare la versione sul telefono prima del rilascio. I branch deploy restano spenti: un push su `dev` non genera deploy.

Le migrazioni del database si applicano al progetto Supabase di produzione con un workflow di GitHub Actions a ogni merge su `main`, così database e sito escono insieme.

## Considered Options

- **Cloudflare Pages**: limiti di build molto più larghi. È il piano B se il limite di Netlify diventa stretto: sposteremmo solo l'hosting statico.
- **Migrazioni applicate a mano** (`supabase db push` dal PC): più semplice, ma facile da dimenticare.

## Consequences

- I deploy preview usano lo stesso progetto Supabase della produzione (è l'unico progetto cloud, ADR-0002): una preview non deve mai scrivere dati di prova.
- I segreti del workflow delle migrazioni stanno nell'environment `production` di GitHub, disponibile solo al branch `main`.
