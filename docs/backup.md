# Backup del database

Il piano gratuito di Supabase non fa backup (ADR-0009). Ci pensa il workflow
`.github/workflows/backup.yml`, ogni domenica alle 02:41 UTC; si può anche lanciare a mano da
GitHub → Actions → "Backup settimanale" → Run workflow.

## Cosa contiene

Solo i **dati**, perché lo schema sta già nelle migrazioni del repo:

- `public`: tutte le tabelle, cioè profili, Collection, Deck, Ban List, catalogo, FAQ, registro
  Admin e job;
- `auth.users`, `auth.identities` e `auth.mfa_factors`: account, password (solo l'hash),
  collegamento con Google e verifica in due passaggi;
- `supabase_migrations.schema_migrations`: dice a quale versione dello schema appartiene il
  backup.

Restano fuori sessioni, token e registri di Auth: non servono a ripristinare e sono i dati più
delicati. Restano fuori anche le immagini delle carte, che si riscaricano con l'Image Sync.

## Sicurezza

- Il dump passa in una pipe direttamente ad [`age`](https://age-encryption.org): il file in chiaro
  non esiste mai, né sul runner né nei log. Il workflow non pubblica artifact.
- La **chiave pubblica** sta in `ops/backup/age-recipients.txt`. La **chiave privata** ce l'ha solo il
  proprietario del progetto, nel password manager, e non entra mai nel repo, in GitHub o nella chat.
  Senza di lei i backup non si leggono: se si perde, i backup sono inutili.
- I file vanno come release nel repository **privato** indicato dalla variabile `BACKUP_REPO`
  dell'environment `production`. Il token `BACKUP_REPO_TOKEN` può scrivere solo in quel
  repository. Si tengono le ultime 8 copie e le più vecchie si cancellano davvero, tag compreso.

## Configurazione (una volta sola)

1. **Chiave age**, sul tuo PC:
   - `winget install FiloSottile.age`, poi riapri il terminale;
   - `age-keygen -o op-codex-backup.key`;
   - salva il contenuto del file nel password manager, poi cancella il file;
   - la riga `Public key: age1...` va in `ops/backup/age-recipients.txt`. La chiave pubblica non è
     un segreto.
2. **Repository privato** su GitHub, per esempio `op-codex-backups`, vuoto.
3. **Token** su GitHub → Settings → Developer settings → Fine-grained tokens:
   - accesso solo al repository dei backup;
   - permesso "Contents: Read and write";
   - scadenza di un anno, con un promemoria per rinnovarlo.
4. Nel repo OP-Codex → Settings → Environments → `production`:
   - secret `BACKUP_REPO_TOKEN` con il token;
   - variabile `BACKUP_REPO` con `utente/op-codex-backups`.

## Ripristino di prova sul Supabase locale

Serve la chiave privata. Su Windows `pg_restore` e `age` si usano da un container, così non
serve installare nulla:

1. Parti dal commit con le stesse migrazioni del backup: la più recente è in
   `supabase_migrations.schema_migrations`, di solito basta `main` del giorno del backup.
2. Scarica il file dalla release del repository dei backup.
3. Ricrea lo schema pulito: `npx supabase db reset`. **Cancella i dati locali.**
4. Ripristina (`backup` è la cartella con il file `.dump.age` e con la chiave in `key.txt`):

   ```sh
   docker run --rm -v "$PWD/ops/backup:/ops" -v "$PWD/backup:/w" \
     -e LOCAL_DB_URL=postgresql://postgres:postgres@host.docker.internal:54322/postgres \
     postgres:17-alpine sh -c "apk add -q age bash && bash /ops/restore-local.sh /w/<file>.dump.age /w/key.txt"
   ```

   Lo script svuota le tabelle, carica i dati con trigger e chiavi esterne spenti (modalità
   replica, come indica Supabase) e mostra le righe per tabella. Si rifiuta di lavorare su un
   database che non sia locale.

5. Cancella la chiave e il backup dalla cartella di lavoro.

**Prova eseguita il 2026-09-25** con una chiave usa e getta, sul database locale: 33 utenti con
password, 31 profili, Collection, Deck, 2.785 carte, 4.843 Printing, 926 FAQ, registro Admin e job.
Dopo `db reset` e ripristino, conteggi, sequenze e versione delle migrazioni erano identici a prima.
Il file cifrato non conteneva testo in chiaro. Da ripetere con il primo backup vero di produzione.

## Ripristino in produzione (emergenza)

Su un progetto Supabase nuovo:

1. Applica le migrazioni: `npx supabase link` e poi `npx supabase db push`.
2. Carica i dati come nello script, ma con `LOCAL_DB_URL` puntato al nuovo progetto. Lo script
   rifiuta i database non locali di proposito: per l'emergenza si usano a mano gli stessi due
   comandi, svuotamento e `pg_restore … | psql`.
3. Rimetti `image_synced_at` a null sulle Printing e lancia l'Image Sync, perché le immagini non
   sono nel backup.
4. Aggiorna chiavi e URL del nuovo progetto in Netlify, nei segreti di GitHub e nella CSP.
