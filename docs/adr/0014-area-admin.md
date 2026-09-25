# Area Admin: ruolo letto dal database, sempre con la verifica in due passaggi

L'area Admin (RIB-19, `/admin`) è la base su cui le fasi successive aggiungono le loro sezioni (Ban List, segnalazioni, Mapping Override). Come per l'account (ADR-0013), le regole le fa rispettare il database:

- **Ruolo**: `app_metadata.admin = true` su `auth.users`. Si assegna e si toglie solo dalla dashboard di Supabase con i comandi di `docs/admin.md`, che scrivono anche una riga nel registro. L'app non può farlo, e `user_metadata`, che l'utente può modificare, non conta.
- **Admin attivo** (`private.admin_attivo()`): ruolo **letto da `auth.users` a ogni richiesta**, sessione ancora valida (`private.accesso_valido()`) e JWT `aal2`. La verifica in due passaggi, facoltativa per gli altri, per l'Admin è obbligatoria. Ogni policy admin usa questa funzione.
- **Registro** (`admin_audit_log`): chi, cosa, quando, prima e dopo. Lo scrive il trigger `private.registra_azione_admin()`, da mettere su ogni tabella gestita dall'Admin. Si può solo aggiungere: un trigger rifiuta update, delete e truncate a chiunque, anche dalla dashboard o con `service_role`. L'autore è un uuid senza chiave esterna, così la riga resta anche se l'account viene eliminato.
- **Stato dei job**: l'Admin attivo legge `job_runs`; scrive sempre e solo il job.

L'app chiede `public.stato_admin()` (`no`, `codice`, `ok`) solo per decidere cosa mostrare. La voce "Area Admin" nelle Impostazioni legge il ruolo dal token ed è una scorciatoia, non un controllo.

## Considered Options

- **Ruolo letto dal JWT** (`auth.jwt() -> 'app_metadata'`): nessuna lettura in più, ma un ruolo tolto resta valido fino al rinnovo del token, fino a un'ora. Leggere `auth.users` costa una ricerca per chiave primaria.
- **Script locale con la chiave `service_role`** per assegnare il ruolo: una chiave segreta in più sul computer dell'Admin per un'operazione che si fa una volta. L'editor SQL della dashboard è già protetto dall'accesso a Supabase.
- **Pagina per leggere il registro**: rimandata alla prima sezione che modifica dati (Ban List, RIB-29). Oggi le uniche righe sono le assegnazioni del ruolo.

## Consequences

- Ogni nuova tabella gestita dall'Admin deve avere policy basate su `(select private.admin_attivo())` e il trigger `registra_azione_admin`.
- Un Admin senza la verifica attiva vede solo l'invito ad attivarla.
- Le righe del registro non si possono correggere: un errore si corregge con una nuova azione, che lascia a sua volta la sua riga.
