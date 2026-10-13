# Area Admin: ruolo letto dal database, sempre con la verifica in due passaggi

L'area Admin (RIB-19, `/admin`) è la base su cui le fasi successive aggiungono le loro sezioni (Ban List, segnalazioni, Mapping Override). Come per l'account (ADR-0013), le regole le fa rispettare il database:

- **Ruolo**: `app_metadata.admin = true` su `auth.users`. Si assegna e si toglie solo dalla dashboard di Supabase con i comandi di `docs/admin.md`, che scrivono anche una riga nel registro. L'app non può farlo, e `user_metadata`, che l'utente può modificare, non conta.
- **Admin attivo** (`private.admin_attivo()`): ruolo **letto da `auth.users` a ogni richiesta**, sessione ancora valida (`private.accesso_valido()`), JWT `aal2` e codice TOTP dato **nelle ultime 12 ore** (`private.codice_recente()`, dal claim `amr`: RIB-98). La verifica in due passaggi, facoltativa per gli altri, per l'Admin è obbligatoria. Ogni policy admin usa questa funzione. Le 12 ore servono perché una sessione `aal2` si rinnova col refresh token senza scadenza (il limite di durata delle sessioni è a pagamento): un token Admin rubato varrebbe per sempre. Supabase Auth aggiorna il timestamp `totp` dell'`amr` a ogni nuovo codice e lo conserva nei rinnovi.
- **Registro** (`admin_audit_log`): chi, cosa, quando, prima e dopo. Lo scrive il trigger `private.registra_azione_admin()`, da mettere su ogni tabella gestita dall'Admin. Si può solo aggiungere: un trigger rifiuta update, delete e truncate a chiunque, anche dalla dashboard o con `service_role`. L'autore è un uuid senza chiave esterna, così la riga resta anche se l'account viene eliminato.
- **Stato dei job**: l'Admin attivo legge `job_runs`; scrive sempre e solo il job.

L'app chiede `public.stato_admin()` (`no`, `codice`, `rinnova`, `ok`) solo per decidere cosa mostrare; con `rinnova` (codice di più di 12 ore fa) chiede il codice sul posto. La voce "Area Admin" nelle Impostazioni legge il ruolo dal token ed è una scorciatoia, non un controllo.

**Utenti e panoramica** (RIB-89): `auth.users` e `auth.sessions` restano invisibili all'app; l'Admin attivo li legge e li tocca solo con funzioni `security definer` che lo verificano da sé (`private.richiedi_admin()`):

- `admin_panoramica()`: numeri dell'app e, per ogni job, l'ultima esecuzione. Un job è **fermo** se non gira da oltre 26 ore (girano tutti ogni notte), **fallito** se l'ultima esecuzione è fallita.
- `admin_utenti()`: elenco **senza email**; `admin_utente(id)`: dettaglio con email, metodi di accesso e sessioni aperte.
- `admin_sospendi_utente(id, sospeso)`: `banned_until` nel futuro (Supabase Auth rifiuta accessi e rinnovi) e chiusura delle sessioni, così anche i token già emessi smettono subito di valere; `admin_chiudi_sessioni(id)`.
- Le azioni non valgono mai su se stessi né su un altro Admin, e scrivono una riga nel registro. Eliminare un account o cambiare ruolo resta solo dalla dashboard.

## Considered Options

- **Ruolo letto dal JWT** (`auth.jwt() -> 'app_metadata'`): nessuna lettura in più, ma un ruolo tolto resta valido fino al rinnovo del token, fino a un'ora. Leggere `auth.users` costa una ricerca per chiave primaria.
- **Script locale con la chiave `service_role`** per assegnare il ruolo: una chiave segreta in più sul computer dell'Admin per un'operazione che si fa una volta. L'editor SQL della dashboard è già protetto dall'accesso a Supabase.
- **Pagina per leggere il registro**: rimandata alla prima sezione che modifica dati (Ban List, RIB-29). Oggi le uniche righe sono le assegnazioni del ruolo.

## Consequences

- Ogni nuova tabella gestita dall'Admin deve avere policy basate su `(select private.admin_attivo())` e il trigger `registra_azione_admin`.
- Un Admin senza la verifica attiva vede solo l'invito ad attivarla.
- Le righe del registro non si possono correggere: un errore si corregge con una nuova azione, che lascia a sua volta la sua riga.
