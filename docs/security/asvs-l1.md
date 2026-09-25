# Checklist OWASP ASVS 5.0 — livello 1

Verifica di OP-Codex contro i 70 requisiti di livello 1 di
[OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS/tree/master/5.0), più i punti di livello 2 scelti
nel PRD (verifica in due passaggi obbligatoria per l'Admin). Eseguita il **2026-09-25** su `dev`
(RIB-35); da ripetere a ogni fase che tocca account, dati personali o nuovi servizi esterni.

Esiti: ✅ conforme · ⚠️ conforme con eccezione motivata · ➖ non applicabile.

Architettura in breve, per leggere gli esiti:

- PWA statica su Netlify;
- dati e accesso su Supabase: Postgres con RLS, Auth, Storage;
- nessun server applicativo nostro: l'autorizzazione sta tutta nelle policy RLS e nelle funzioni
  SQL (ADR-0003, ADR-0013, ADR-0014);
- la sessione è un JWT di Supabase inviato nell'intestazione `Authorization`, senza cookie.

## V1 Codifica e sanificazione

| ID    | Esito | Verifica                                                                                                                                                                                                                       |
| ----- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1.2.1 | ✅    | Tutto il testo (anche quello ufficiale delle carte e le FAQ) passa da React, che fa l'escape; nel codice non c'è `dangerouslySetInnerHTML` né `innerHTML`. Test: `CardDetail.test.tsx` ("mostrato come testo, mai come HTML"). |
| 1.2.2 | ✅    | Gli URL si costruiscono con `URLSearchParams` e percorsi fissi (`card-links.ts`, `paths.ts`). Nessun `href` viene da dati degli utenti. Il token dello Share Link è base64url e validato dal database (`^[A-Za-z0-9_-]{22}$`). |
| 1.2.3 | ✅    | Nessun JavaScript generato dinamicamente; il JSON si produce solo con `JSON.stringify`.                                                                                                                                        |
| 1.2.4 | ✅    | Le query passano da PostgREST (parametri) e da funzioni SQL con parametri tipizzati. Nessun `EXECUTE` dinamico con input degli utenti. Gli script del job usano query parametrizzate di `postgres`.                            |
| 1.2.5 | ✅    | L'app non esegue comandi di sistema. Gli script di CI (`ops/backup`, Catalog Sync) non ricevono input dagli utenti.                                                                                                            |
| 1.3.1 | ➖    | Nessun editor HTML o WYSIWYG.                                                                                                                                                                                                  |
| 1.3.2 | ✅    | Nessun `eval` o `new Function`; la CSP non consente `unsafe-eval`.                                                                                                                                                             |
| 1.5.1 | ➖    | Nessun parser XML. Il Catalog Sync legge l'HTML del sito ufficiale con cheerio, che non risolve entità esterne.                                                                                                                |

## V2 Validazione e logica di business

| ID    | Esito | Verifica                                                                                                                                                                                                                                                                                           |
| ----- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1.1 | ✅    | Le regole sono nella sezione [Regole di validazione](#regole-di-validazione) qui sotto e sono imposte dai vincoli del database.                                                                                                                                                                    |
| 2.2.1 | ✅    | Liste consentite e intervalli nel database (lingue, formati, quantità, Username, codici). Aggiunto con questa verifica: **massimo 200 Deck per utente** (migrazione `20260925180000_deck_limit.sql`, test in `tests/db/decks.test.ts`).                                                            |
| 2.2.2 | ✅    | Ogni regola sta nel database (vincoli, RLS, funzioni). I controlli nel browser servono solo a dare messaggi più chiari.                                                                                                                                                                            |
| 2.3.1 | ✅    | Registrazione → conferma email → Username: senza profilo le tabelle personali sono chiuse. Con la verifica in due passaggi attiva il database non apre nulla senza `aal2` (`private.accesso_valido()`). L'eliminazione dell'account richiede un accesso recente (meno di 10 minuti) e lo Username. |

## V3 Sicurezza del frontend web

| ID    | Esito | Verifica                                                                                                                                                                                                                                                                                  |
| ----- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.2.1 | ✅    | Gli utenti non caricano file. Le immagini delle carte le carica solo l'Image Sync, come `image/webp`. L'export è un Blob scaricato con l'attributo `download`.                                                                                                                            |
| 3.2.2 | ✅    | Vedi 1.2.1: il testo si inserisce solo come testo.                                                                                                                                                                                                                                        |
| 3.3.1 | ➖    | L'app non usa cookie: la sessione Supabase sta nello storage del browser e viaggia nell'intestazione `Authorization`.                                                                                                                                                                     |
| 3.4.1 | ✅    | `Strict-Transport-Security: max-age=63072000; includeSubDomains` (`netlify.toml`).                                                                                                                                                                                                        |
| 3.4.2 | ⚠️    | Netlify non invia intestazioni CORS. L'API di Supabase risponde con `Access-Control-Allow-Origin: *`, ma i dati personali richiedono il token nell'intestazione `Authorization`, che il browser non allega da solo. Senza token si leggono solo i dati pubblici: catalogo, FAQ, Ban List. |
| 3.5.1 | ➖    | Niente autenticazione con cookie, quindi nessuna richiesta cross-site porta credenziali: il CSRF non si applica.                                                                                                                                                                          |
| 3.5.2 | ➖    | Come 3.5.1.                                                                                                                                                                                                                                                                               |
| 3.5.3 | ✅    | Le modifiche usano POST, PATCH e DELETE (PostgREST, RPC in POST); le GET leggono soltanto.                                                                                                                                                                                                |

## V4 Servizi web

| ID    | Esito | Verifica                                                                         |
| ----- | ----- | -------------------------------------------------------------------------------- |
| 4.1.1 | ✅    | Netlify e Supabase inviano `Content-Type` corretti; `index.html` dichiara UTF-8. |
| 4.4.1 | ➖    | Nessun WebSocket (Realtime di Supabase non usato).                               |

## V5 File

| ID    | Esito | Verifica                                                                                                                                                          |
| ----- | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5.2.1 | ➖    | Nessun upload. L'import dei Deck è testo incollato; le carte finiscono comunque nei limiti del database (≤ 50 copie, codici del catalogo).                        |
| 5.2.2 | ➖    | Nessun upload.                                                                                                                                                    |
| 5.3.1 | ➖    | Nessun upload, nessun codice lato server.                                                                                                                         |
| 5.3.2 | ✅    | L'unico file generato con dati degli utenti è l'export: i nomi dei Deck vengono ripuliti (`safeFileName`: niente `/ \ : * ? " < > \|` né caratteri di controllo). |

## V6 Autenticazione

| ID            | Esito | Verifica                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1.1         | ✅    | Vedi [Difese dagli attacchi automatici](#difese-dagli-attacchi-automatici).                                                                                                                                                                                                                                                                                                              |
| 6.2.1         | ✅    | Minimo 10 caratteri, imposto da Supabase (`minimum_password_length`) e dal modulo.                                                                                                                                                                                                                                                                                                       |
| 6.2.2         | ✅    | Profilo → Account e sicurezza → Password.                                                                                                                                                                                                                                                                                                                                                |
| 6.2.3         | ✅    | Servono la password attuale (verificata con un nuovo accesso, con CAPTCHA) e, se attivo, il codice della verifica in due passaggi.                                                                                                                                                                                                                                                       |
| 6.2.4         | ⚠️    | La password viene confrontata con Have I Been Pwned (k-anonymity), un elenco molto più ampio delle 3.000 più comuni, ma il controllo avviene nel browser. Chi chiamasse l'API di Auth direttamente lo salterebbe: la protezione lato server di Supabase è solo nel piano Pro. Mitigazioni: minimo 10 caratteri lato server e CAPTCHA obbligatorio. Da rivedere se si passa al piano Pro. |
| 6.2.5         | ✅    | Nessuna regola sui tipi di carattere (`password_requirements = ""`).                                                                                                                                                                                                                                                                                                                     |
| 6.2.6         | ✅    | `type="password"`, con un pulsante per mostrarla temporaneamente (`PasswordField`).                                                                                                                                                                                                                                                                                                      |
| 6.2.7         | ✅    | Incolla e password manager consentiti: nessun blocco, `autocomplete` corretti (`current-password`, `new-password`).                                                                                                                                                                                                                                                                      |
| 6.2.8         | ✅    | La password si invia così com'è, senza trim né cambi di maiuscole. Oltre i 72 caratteri (limite di bcrypt) Supabase **rifiuta** la password invece di troncarla: verificato in locale ("Password cannot be longer than 72 characters").                                                                                                                                                  |
| 6.3.1         | ✅    | CAPTCHA Turnstile verificato da Supabase su accesso, registrazione e recupero; limiti di frequenza di Auth.                                                                                                                                                                                                                                                                              |
| 6.3.2         | ✅    | Nessun account predefinito. Il ruolo Admin si assegna a mano a un account esistente (`docs/admin.md`). Username come "admin", "root" o "staff" sono riservati (vincolo `profiles_username_reserved`).                                                                                                                                                                                    |
| 6.4.1         | ✅    | I link email (conferma, recupero) sono generati da Supabase, monouso e scadono dopo un'ora (`otp_expiry = 3600`). Non esistono password iniziali generate dal sistema.                                                                                                                                                                                                                   |
| 6.4.2         | ✅    | Nessun suggerimento né domanda segreta.                                                                                                                                                                                                                                                                                                                                                  |
| L2: MFA Admin | ✅    | L'area Admin richiede la verifica in due passaggi: `private.admin_attivo()` esige `aal2` (ADR-0014).                                                                                                                                                                                                                                                                                     |

## V7 Sessioni

| ID    | Esito | Verifica                                                                                                                                                                                                         |
| ----- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 7.2.1 | ✅    | Il token lo verifica Supabase (PostgREST e Auth). In più ogni policy personale richiede che la sessione esista ancora nel database (`private.accesso_valido()`, ADR-0013).                                       |
| 7.2.2 | ✅    | JWT dinamici per ogni sessione. La chiave pubblicabile di Supabase non dà accesso ai dati personali.                                                                                                             |
| 7.2.3 | ✅    | Refresh token generati da Supabase in modo casuale.                                                                                                                                                              |
| 7.2.4 | ✅    | Ogni accesso, compreso il nuovo accesso per cambiare password, crea una sessione nuova.                                                                                                                          |
| 7.4.1 | ✅    | "Esci" chiude la sessione sul server (`signOut`). Il JWT ancora in corso di validità non basta più, perché le policy controllano che la sessione esista (ADR-0013, test in `tests/db/account-security.test.ts`). |
| 7.4.2 | ✅    | L'eliminazione dell'account cancella l'utente e, a cascata, sessioni e dati: l'accesso cessa subito. "Esci da tutti i dispositivi" chiude tutte le sessioni.                                                     |

## V8 Autorizzazione

| ID    | Esito | Verifica                                                                                                                                                                                                                               |
| ----- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 8.1.1 | ✅    | Regole documentate: ADR-0003 (RLS), ADR-0013 (sessione valida), ADR-0014 (Admin); in breve: ognuno vede e modifica solo i propri dati; catalogo, FAQ e Ban List sono pubblici in lettura; l'Admin modifica solo la Ban List.           |
| 8.2.1 | ✅    | Funzioni e tabelle con `grant` minimi. L'area Admin è protetta dal database, non dall'interfaccia.                                                                                                                                     |
| 8.2.2 | ✅    | RLS su ogni tabella personale (`user_id = auth.uid()`). I Deck condivisi si leggono solo con il token esatto (`mazzo_condiviso`). Test con due utenti in `tests/db/` (collection, decks, deck-share, profiles) e nell'E2E dell'export. |
| 8.3.1 | ✅    | Tutto nel database; l'interfaccia nasconde solo ciò che il database negherebbe comunque.                                                                                                                                               |

## V9 Token autocontenuti

| ID    | Esito | Verifica                                                           |
| ----- | ----- | ------------------------------------------------------------------ |
| 9.1.1 | ✅    | JWT firmati e verificati da Supabase; l'app non li verifica da sé. |
| 9.1.2 | ✅    | Algoritmi scelti da Supabase, `none` non accettato.                |
| 9.1.3 | ✅    | Chiavi di verifica configurate in Supabase, non prese dal token.   |
| 9.2.1 | ✅    | `exp` verificato da Supabase; durata 1 ora (`jwt_expiry = 3600`).  |

## V10 OAuth

| ID            | Esito | Verifica                                                                                                                                                     |
| ------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 10.4.1–10.4.4 | ➖    | Non gestiamo un authorization server: con Google il flusso è PKCE gestito da Supabase Auth, che accetta solo gli URL di ritorno configurati (Redirect URLs). |
| 10.4.5        | ✅    | Rotazione dei refresh token attiva con rilevamento del riuso (`enable_refresh_token_rotation = true`).                                                       |

## V11 Crittografia

| ID     | Esito | Verifica                                                                                                                                                                                                                  |
| ------ | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 11.3.1 | ✅    | Nessuna cifratura fatta a mano. I backup usano `age` (X25519 + ChaCha20-Poly1305).                                                                                                                                        |
| 11.3.2 | ✅    | Solo algoritmi moderni: TLS dei provider e `age`.                                                                                                                                                                         |
| 11.4.1 | ✅    | Hash delle password: bcrypt di Supabase. SHA-1 si usa solo come chiave di ricerca nell'API di Have I Been Pwned (è il protocollo dell'API), non per proteggere dati. Token degli Share Link: `gen_random_bytes` (CSPRNG). |

## V12 Comunicazioni sicure

| ID     | Esito | Verifica                                                                                         |
| ------ | ----- | ------------------------------------------------------------------------------------------------ |
| 12.1.1 | ✅    | TLS 1.2/1.3 gestito da Netlify e Supabase.                                                       |
| 12.2.1 | ✅    | Solo HTTPS: HSTS, `upgrade-insecure-requests` nella CSP, connessioni del job con `ssl: require`. |
| 12.2.2 | ✅    | Certificati pubblici di Netlify (Let's Encrypt) e Supabase.                                      |

## V13 Configurazione

| ID     | Esito | Verifica                                                                                                                               |
| ------ | ----- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 13.4.1 | ✅    | Netlify pubblica solo `dist/`: niente `.git` né sorgenti. Le source map vanno solo a Sentry e si cancellano prima della pubblicazione. |

## V14 Protezione dei dati

| ID     | Esito | Verifica                                                                                                                                                                                                                                                                                                                                                                           |
| ------ | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 14.2.1 | ⚠️    | Nessuna chiave o sessione negli URL. Eccezioni volute, entrambe revocabili o monouso: il token dello Share Link sta nel percorso `/m/<token>`, perché è il link da condividere (si revoca quando si vuole, RIB-26); i link email di Supabase contengono un `token_hash` monouso che scade in un'ora. Sentry riceve gli URL senza query e con il token sostituito da un segnaposto. |
| 14.3.1 | ✅    | All'uscita si cancellano la sessione (Supabase) e la copia locale dei dati personali (`op-codex-personal`, RIB-27, test E2E). Catalogo e Ban List sul dispositivo sono pubblici.                                                                                                                                                                                                   |

## V15 Codice sicuro e dipendenze

| ID     | Esito | Verifica                                                                                                                                              |
| ------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 15.1.1 | ✅    | Tempi di correzione nella sezione [Dipendenze](#dipendenze).                                                                                          |
| 15.2.1 | ✅    | `npm audit --omit=dev`: 0 vulnerabilità (2026-09-25). Dependabot ogni settimana.                                                                      |
| 15.3.1 | ✅    | Le query chiedono colonne esplicite. `mazzo_condiviso` restituisce solo nome, Leader, formato, data, carte e Username, non l'id dell'utente né altro. |

## Regole di validazione

Imposte dal database; il browser ripete le stesse regole solo per dare messaggi più chiari.

- **Username**: `^[A-Za-z0-9_]{3,20}$`, unico senza distinzione di maiuscole, nomi riservati esclusi.
- **Password**: almeno 10 caratteri (massimo 72, limite di bcrypt), nessuna regola sui caratteri.
- **Collection**: Printing esistente, lingua tra EN, JP, FR, CN e KR, da 1 a 9.999 copie.
- **Deck**:
  - nome di 1–60 caratteri;
  - Leader e carte esistenti nel catalogo;
  - da 1 a 50 copie per carta, Printing coerente con la carta;
  - formato `standard` o `extra`;
  - visibilità `private`, `link` o `friends`;
  - al massimo 200 Deck per utente.
- **Share Link**: token di 22 caratteri base64url, presente solo con la visibilità `link`.
- **Ban List** (solo Admin): Card Code `^[A-Z0-9]+-[0-9]+$`, tipo tra `banned`, `restricted` e `pair`,
  copie da 0 a 3 per le limitate.

## Difese dagli attacchi automatici

- **CAPTCHA Cloudflare Turnstile** su registrazione, accesso e recupero password, verificato da
  Supabase lato server (senza token valido Auth rifiuta la richiesta).
- **Limiti di frequenza di Supabase Auth**:
  - accessi e registrazioni: 30 ogni 5 minuti per indirizzo IP;
  - verifiche dei token: 30 ogni 5 minuti per indirizzo IP;
  - email: 2 all'ora per tutto il progetto (in produzione, con l'SMTP personalizzato, il valore si
    imposta nella dashboard).

  Valori del progetto locale (`supabase/config.toml`). In produzione si impostano nella dashboard,
  sotto Authentication → Rate Limits: vanno controllati che siano uguali o più stretti.

- **Nessun blocco dell'account** dopo tentativi falliti: eviterebbe che un malintenzionato blocchi gli
  account degli altri. Bastano CAPTCHA e limiti per IP.
- **Verifica in due passaggi** facoltativa per tutti, obbligatoria per l'Admin.

## Dipendenze

- Dependabot apre ogni settimana le PR di aggiornamento verso `dev`; npm audit gira in CI.
- Tempi di correzione delle vulnerabilità note, dalla segnalazione:
  - **critiche e alte**: entro 7 giorni, con un merge dedicato se serve;
  - **medie**: entro 30 giorni;
  - **basse**: con il primo aggiornamento utile.
- Una dipendenza abbandonata o senza correzione si sostituisce o si rimuove entro gli stessi tempi.

## Da controllare in produzione

Punti che non si verificano dal codice:

1. Limiti di frequenza di Auth nella dashboard (vedi sopra).
2. Authentication → URL Configuration: solo gli indirizzi dell'app tra i Redirect URLs.
3. Sentry → Settings → Security & Privacy: attivare "Prevent Storing of IP Addresses" e i Data
   Scrubber predefiniti. L'app già non invia l'IP, ma Sentry lo ricava dalla richiesta.
