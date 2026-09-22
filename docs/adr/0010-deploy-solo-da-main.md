# Deploy in produzione solo al merge su main, anteprime Netlify disattivate

Il piano gratuito di Netlify ha 300 crediti al mese e ogni deploy di produzione ne costa 15, cioè circa 20 deploy al mese. Lo sviluppo avviene quindi sul branch `dev` e su `main` arriva solo un merge per ogni funzionalità completata. I deploy preview dei branch restano disattivati finché non verifichiamo se consumano crediti.

## Considered Options

- **Cloudflare Pages**: limiti di build molto più larghi. È il piano B se il limite di Netlify diventa stretto: sposteremmo solo l'hosting statico.
