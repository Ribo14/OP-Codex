#!/usr/bin/env bash
# Backup cifrato del database (RIB-35, ADR-0009).
#
# Dump dei soli dati (lo schema sta nelle migrazioni del repo) di:
#   - public: profili, Collection, Deck, Ban List, catalogo, FAQ, registri
#   - auth: utenti, identità (Google) e fattori della verifica in due passaggi
#   - supabase_migrations: la versione dello schema, per sapere su quale commit ripristinare
# Sessioni, token e registri di Auth restano fuori: non servono a ripristinare e sono i dati
# più delicati. Il dump passa in una pipe direttamente ad `age`: in chiaro non tocca mai il
# disco né i log.
#
# Uso: SUPABASE_DB_URL=... ops/backup/backup.sh <file di uscita .dump.age>
# Variabili facoltative: PG_DUMP (percorso di pg_dump), AGE (percorso di age).

set -euo pipefail

out="${1:?Serve il file di uscita, es. op-codex-2026-09-28.dump.age}"
: "${SUPABASE_DB_URL:?Serve SUPABASE_DB_URL}"
pg_dump="${PG_DUMP:-pg_dump}"
age="${AGE:-age}"
recipients="$(dirname "$0")/age-recipients.txt"

# Senza una chiave pubblica vera non si fa nessun dump.
if ! grep -q '^age1' "$recipients"; then
  echo "Manca la chiave pubblica age in $recipients" >&2
  exit 1
fi

# Solo --table: combinato con --table, --schema verrebbe ignorato.
"$pg_dump" \
  --dbname="$SUPABASE_DB_URL" \
  --format=custom \
  --data-only \
  --no-owner \
  --no-privileges \
  --table='public.*' \
  --table=auth.users \
  --table=auth.identities \
  --table=auth.mfa_factors \
  --table=supabase_migrations.schema_migrations \
  | "$age" --encrypt --recipients-file "$recipients" --output "$out"

# Controllo: il file esiste, non è vuoto ed è davvero cifrato con age.
if [ ! -s "$out" ] || [ "$(head -c 21 "$out")" != "age-encryption.org/v1" ]; then
  echo "Il backup non è un file age valido" >&2
  exit 1
fi
echo "Backup cifrato: $out ($(wc -c < "$out") byte)"
