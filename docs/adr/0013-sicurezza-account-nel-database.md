# Sicurezza dell'account fatta rispettare dal database

Con RIB-18 ogni User può uscire da tutti i dispositivi, attivare la verifica in due passaggi (codice TOTP da un'app di autenticazione) ed eliminare l'account. Tutte e tre le regole le fa rispettare **il database**, non solo l'app:

- **Accesso valido** (`private.accesso_valido()`): ogni tabella con dati personali ha, oltre alle sue policy, una policy `restrictive` che richiede che la sessione del JWT esista ancora in `auth.sessions` e, per chi ha un fattore TOTP confermato, che il JWT sia `aal2`. Così "Esci da tutti i dispositivi" ha effetto **subito**, anche sui token già emessi e non ancora scaduti, e senza il codice i dati personali restano chiusi anche a chi chiama le API direttamente.
- **Eliminazione dell'account** (`public.elimina_account(conferma_username)`): una funzione `security definer` che cancella sempre e solo l'utente che la chiama (`auth.uid()`), dopo aver controllato lo Username scritto come conferma e che l'ultimo accesso (password, Google o codice, dal claim `amr` del JWT) sia di meno di 10 minuti fa. Tutti i dati personali partono a cascata da `auth.users`.
- **Durata dell'accesso**: si resta dentro finché non si esce. Il JWT dura un'ora (`jwt_expiry`) e si rinnova da solo; la sessione finisce con "Esci", con "Esci da tutti i dispositivi" o con l'eliminazione dell'account.

## Regola per le tabelle future

Ogni nuova tabella con dati di un User deve avere:

1. una colonna che punta ad `auth.users (id)` con `on delete cascade`: il test `tests/db/account-security.test.ts` fallisce se una chiave esterna verso `auth.users` non lo ha;
2. la policy `"Solo con un accesso valido"`, `as restrictive for all to authenticated using ((select private.accesso_valido()))`.

## Considered Options

- **Edge Function per l'eliminazione** (prevista all'inizio da RIB-18): un servizio in più da pubblicare, con la chiave `service_role`, per fare quello che una funzione SQL fa con le stesse garanzie e con test sul database locale.
- **Uscita ovunque solo lato Supabase Auth** (`signOut({ scope: 'global' })` e basta): gli altri dispositivi non rinnovano più l'accesso, ma i token già emessi restano validi fino a un'ora. Accorciare il JWT riduce l'attesa ma aumenta i rinnovi; controllare la sessione nel database la azzera, con un costo trascurabile ai nostri volumi.
- **Durata massima e inattività delle sessioni** (`[auth.sessions]` timebox e inactivity_timeout): disponibili solo nel piano Pro di Supabase.
- **Riautenticazione con un codice via email** (`auth.reauthenticate()`): vale solo per chi ha la password. Il claim `amr` copre anche chi entra con Google.

## Consequences

- Chi perde il telefono con l'app di autenticazione non può più entrare da solo: il fattore va tolto dall'amministratore dalla dashboard di Supabase (Authentication → Users). I codici di recupero arriveranno se servono.
- Cambiare la password con la verifica attiva chiede anche il codice, perché il nuovo accesso con la password riparte da `aal1`.
- La verifica in due passaggi con TOTP è gratuita su tutti i piani ed è attiva di default in produzione; in locale la attiva `supabase/config.toml`.
