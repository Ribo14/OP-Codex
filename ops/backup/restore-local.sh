#!/usr/bin/env bash
# Ripristino di prova di un backup sul Supabase LOCALE (RIB-35). Procedura completa in
# docs/backup.md.
#
# Prima: `npx supabase db reset` sul commit con le stesse migrazioni del backup (lo schema viene
# dalle migrazioni, il backup contiene solo i dati). Lo script svuota le tabelle con i dati
# (anche quelli inseriti dalle migrazioni, es. la Ban List iniziale) e ci carica il backup.
# Si rifiuta di lavorare su un database che non sia locale: non può toccare la produzione.
#
# Uso: ops/backup/restore-local.sh <backup .dump.age> <chiave privata age>
# Variabili facoltative: LOCAL_DB_URL, PG_RESTORE, PSQL, AGE.

set -euo pipefail

file="${1:?Serve il file del backup (.dump.age)}"
key="${2:?Serve il file con la chiave privata age}"
db="${LOCAL_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"
pg_restore="${PG_RESTORE:-pg_restore}"
psql="${PSQL:-psql}"
age="${AGE:-age}"

host="$(printf '%s' "$db" | sed -E 's#^[a-z]+://([^@/]*@)?([^:/?]+).*#\2#')"
case "$host" in
  127.0.0.1 | localhost | host.docker.internal) ;;
  *)
    echo "Rifiutato: $host non è il database locale" >&2
    exit 1
    ;;
esac

echo "Svuoto le tabelle del database locale..."
# In modalità replica i trigger non scattano: serve per il registro delle azioni Admin, che per
# progetto non si può svuotare (ADR-0014). Vale solo per questa transazione, in locale.
"$psql" "$db" --quiet --set ON_ERROR_STOP=1 <<'SQL'
begin;
set local session_replication_role = replica;
set local client_min_messages = warning;
do $$
declare t text;
begin
  select string_agg(format('%I.%I', schemaname, tablename), ', ') into t
  from pg_tables where schemaname = 'public';
  execute 'truncate ' || t || ', auth.users, supabase_migrations.schema_migrations cascade';
end $$;
commit;
SQL

echo "Carico il backup..."
# Trigger e controlli delle chiavi esterne restano spenti durante il caricamento (modalità
# replica, come indica Supabase per i ripristini): i dati sono già quelli prodotti dai trigger in
# origine, e l'ordine delle tabelle non conta. Il ruolo postgres di Supabase non è proprietario
# delle tabelle auth, quindi "--disable-triggers" di pg_restore non si può usare.
{
  echo 'set session_replication_role = replica;'
  "$age" --decrypt --identity "$key" "$file" | "$pg_restore" --file=- --data-only --no-owner
} | "$psql" "$db" --quiet --single-transaction --set ON_ERROR_STOP=1 --output=/dev/null

echo "Ripristino completato. Righe per tabella:"
"$psql" "$db" --quiet --tuples-only <<'SQL'
select format('%-40s %s', t, (xpath('/row/n/text()',
  query_to_xml(format('select count(*) as n from %s', t), false, true, '')))[1]::text)
from unnest(array[
  'auth.users', 'public.profiles', 'public.collection_entries', 'public.decks',
  'public.deck_cards', 'public.ban_list_entries', 'public.cards', 'public.printings',
  'public.card_faqs'
]) as t;
SQL
