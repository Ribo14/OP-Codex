# Supabase come backend (invece di Firebase)

Usiamo Supabase (Postgres, Auth, Edge Functions) come unico backend. I dati sono fortemente relazionali: Card ↔ Printing ↔ Deck ↔ Collection ↔ Friendship. La Visibility "visibile agli amici" si esprime in modo naturale come policy SQL. Il catalogo pesa pochi MB, quindi la dimensione non era un criterio.

## Considered Options

- **Firebase**: scartato perché Firestore rende scomode le query relazionali (es. "carte mancanti per questo Deck") e perché dal febbraio 2026 Cloud Storage richiede il piano Blaze.

## Consequences

- Il progetto gratuito va in pausa dopo 7 giorni di inattività: il job notturno di Catalog Sync lo tiene attivo.
- Il piano gratuito non ha backup: li facciamo noi (vedi ADR-0009).
- In sviluppo si usa Supabase in locale (Docker); in cloud esiste un solo progetto, quello di produzione.
