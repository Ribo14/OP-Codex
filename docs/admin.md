# Area Admin: assegnare e togliere il ruolo

Il ruolo Admin sta in `app_metadata` dell'utente, che l'app non può modificare (ADR-0003, ADR-0014). Si assegna **solo** dalla dashboard di Supabase, mai dall'app. Ogni cambio di ruolo lascia una riga nel registro delle azioni Admin.

## Assegnare il ruolo

1. L'utente deve avere già un account e aver attivato la **verifica in due passaggi** (Profilo → Account e sicurezza). Senza verifica l'area Admin non si apre.
2. Dashboard di Supabase → progetto OP-Codex → **SQL Editor** → nuova query.
3. Incolla questo comando, metti l'email al posto di `EMAIL` ed esegui:

```sql
with u as (
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"admin": true}'
  where email = 'EMAIL'
  returning id, email
)
insert into public.admin_audit_log (action, table_name, record_id, after)
select 'grant_admin', 'auth.users', id::text, jsonb_build_object('email', email, 'admin', true)
from u
returning *;
```

Deve comparire **una riga**. Se non ne compare nessuna, l'email non corrisponde a nessun account.

4. Nell'app l'area si apre subito all'indirizzo `/admin`. La voce "Area Admin" nelle Impostazioni compare al rinnovo dell'accesso, entro un'ora, oppure uscendo e rientrando.

## Togliere il ruolo

```sql
with u as (
  update auth.users
  set raw_app_meta_data = raw_app_meta_data - 'admin'
  where email = 'EMAIL'
  returning id, email
)
insert into public.admin_audit_log (action, table_name, record_id, before)
select 'revoke_admin', 'auth.users', id::text, jsonb_build_object('email', email, 'admin', true)
from u
returning *;
```

L'accesso all'area si perde subito: il database legge il ruolo a ogni richiesta.

## Un Admin ha perso il telefono con l'app dei codici

Dashboard → **Authentication → Users** → l'utente → rimuovi il fattore MFA. Al prossimo accesso potrà riattivare la verifica con il nuovo telefono.
