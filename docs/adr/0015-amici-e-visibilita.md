# Amici e Visibility: chi vede cosa, deciso dal database

La fase 6 (RIB-33) apre i dati di un User ad altri User: è la parte più delicata per la sicurezza. Come per l'account (ADR-0013) e l'area Admin (ADR-0014), le regole le fa rispettare il database con le policy RLS; l'app decide solo cosa mostrare.

## Matrice di accesso (approvata dall'utente il 2026-09-28)

| Cosa                       | Proprietario | Amico                                       | Non amico                   | Bloccato dal proprietario         |
| -------------------------- | ------------ | ------------------------------------------- | --------------------------- | --------------------------------- |
| Username (ricerca)         | ✓            | ✓                                           | solo con lo Username esatto | ✗ non lo trova                    |
| Deck **Private**           | ✓            | ✗                                           | ✗                           | ✗                                 |
| Deck **Friends**           | ✓            | ✓                                           | ✗                           | ✗                                 |
| Deck **Public Link**       | ✓            | ✓ (anche dal profilo)                       | solo con il link            | solo con il link                  |
| Collection **Private**     | ✓            | ✗                                           | ✗                           | ✗                                 |
| Collection **Friends**     | ✓            | ✓ carte e Set Completion, **mai il valore** | ✗                           | ✗                                 |
| Inviare una Friend Request | —            | —                                           | ✓                           | ✗ (nemmeno con il link di invito) |

- **Visibility dei Deck a tre livelli crescenti**: Private → Friends → Public Link, un solo campo (`decks.visibility`: `private`, `friends`, `link`). Un Deck con Public Link è visibile anche agli amici.
- **Ricerca solo per Username esatto** (maiuscole indifferenti), o con il **link di invito** personale e rigenerabile. Nessuno può sfogliare l'elenco degli iscritti.
- **User Block**: toglie la Friendship e cancella le Friend Request in corso, in entrambe le direzioni. Chi è bloccato non viene avvisato: la ricerca risponde come per uno Username inesistente. Il blocco vale in una direzione, ma finché c'è nessuno dei due può chiedere l'amicizia all'altro.
- **Collection Friends**: l'amico vede le carte possedute e la Set Completion, mai il valore stimato. Il valore si calcola solo nella propria Collection.
- **Link di invito**: aprirlo prepara una Friend Request che l'invitato conferma con un tocco; il proprietario del link deve comunque accettarla.

## Come si realizza

- Tabelle `friend_requests`, `friendships` (una riga per coppia, `user_a < user_b`), `user_blocks`, con cascade da `auth.users` e la policy restrictive "Solo con un accesso valido" (regola delle tabelle personali, ADR-0013).
- Le scritture passano da funzioni `security definer` con controlli espliciti (richiesta, accetta, rifiuta, annulla, rimuovi, blocca), non da insert diretti: così blocchi e duplicati si controllano in un solo posto.
- I dati di un amico si leggono solo da funzioni `security definer` (`profilo_amico`, `mazzo_amico`, `collezione_amico`) che controllano `private.sono_amici(a, b)` e la Visibility. Le policy di `decks`, `deck_cards` e `collection_entries` restano "solo i propri": le liste dei propri dati leggono le tabelle affidandosi alle policy, e un caso "amico" nelle policy ci farebbe entrare i dati degli altri (RIB-73).
- La Collection di un amico arriva senza prezzi: il valore stimato non si mostra (è una scelta di presentazione; le copie sono comunque visibili).
- Ogni riga della matrice ha un test sul database che agisce come i diversi User.
- Friendship, Friend Request e User Block entrano nell'export dei dati e si cancellano con l'account.

## Considered Options

- **Due interruttori separati per i Deck** ("visibile agli amici" e "Public Link"): più flessibile, ma una combinazione in più da spiegare e da testare. Scartata.
- **Ricerca per prime lettere**: più comoda, ma permette di scoprire chi è iscritto. Scartata.
- **Valore della Collection visibile agli amici**: scartato su richiesta dell'utente.

## Consequences

- Una nuova tabella con dati personali condivisibili deve dichiarare la sua riga nella matrice e avere i test corrispondenti.
- Notifiche push delle richieste: fuori dal perimetro (solo il badge nell'app).
