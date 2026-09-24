# Accesso con Google: stessa email, stesso account

Con "Continua con Google" (RIB-17), se esiste già un account OP-Codex con la stessa email (registrato con email e password), Supabase **collega automaticamente** l'identità Google a quell'account: stesso User, stesso Username, stessi dati. È il comportamento predefinito di Supabase Auth quando il fornitore garantisce che l'email è verificata, come fa Google. L'utente può poi entrare in entrambi i modi.

Il flusso usa PKCE (`flowType: 'pkce'` in `src/lib/supabase.ts`): al ritorno da Google l'indirizzo porta solo un codice monouso, valido per il browser che ha avviato l'accesso, e nessun token. I link delle email restano con `token_hash` e funzionano anche aperti su un altro dispositivo (verificato dal test E2E).

Un nuovo User arrivato da Google sceglie lo Username prima di proseguire: `UsernameGate` nella shell porta al Profilo chiunque abbia una sessione ma nessun profilo, e poi lo riporta dove voleva andare.

## Considered Options

- **Collegamento manuale** (l'utente entra con la password e collega Google dal Profilo): più controllo, ma un passaggio in più che quasi nessuno farebbe, e chi prova Google per primo si troverebbe con un secondo account vuoto. Il rischio che il collegamento automatico copre male, cioè un'email non verificata, qui non esiste: Supabase collega solo email verificate, e in OP-Codex la conferma dell'email è obbligatoria (RIB-14).
- **Flusso implicito** (predefinito di supabase-js): i token tornano nell'indirizzo della pagina e finiscono nella cronologia. PKCE è l'opzione raccomandata.

## Consequences

- Nella schermata di Google compare il dominio del progetto Supabase (`khxjggxukrodbnczoryn.supabase.co`), non quello del sito: per cambiarlo servirebbe un dominio personalizzato su Supabase (a pagamento).
- Nella PWA installata su iPhone, l'accesso con Google può aprirsi in una finestra di Safari separata dall'app: se al ritorno la sessione resta in Safari, il workaround è accedere con email e password nell'app. Da verificare sul dispositivo (RIB-17).
- Chi ha solo l'accesso Google e vuole anche una password può usare "Password dimenticata" con la stessa email.
