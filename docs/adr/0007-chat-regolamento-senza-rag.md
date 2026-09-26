# Chat sul regolamento rinviata: al suo posto la ricerca nel regolamento

**Stato (2026-09-26): rinviata.** Con budget AI a €0 non c'è un modo gratuito e affidabile di offrire una chat dal vivo: l'abbonamento a Claude dell'Admin non può alimentare le chiamate dell'app, e i piani gratuiti di altri fornitori usano le domande per i propri modelli oppure sbagliano più spesso le regole. Al suo posto la **Rules Search**: ricerca nel testo delle Comprehensive Rules e delle FAQ ufficiali, sul dispositivo e offline. Le risposte sono i testi ufficiali, quindi non possono essere inventate.

## Decisione originale, valida se la chat tornerà

Le Rules Question sono gestite da un modello economico (Claude Haiku 4.5) a cui passiamo l'intero testo delle Comprehensive Rules, tenuto in cache con il prompt caching. Non usiamo un sistema di ricerca semantica (embedding e vector store). Il documento è abbastanza piccolo da stare nel contesto, e averlo intero evita risposte sbagliate dovute a spezzoni recuperati male.

## Consequences

- Rules Search: nessun costo, nessun dato inviato a terzi; il testo delle regole convertito per la ricerca serve anche alla chat futura.
- Se la chat tornerà: il modello non ha strumenti né accesso ai dati degli utenti, quindi una prompt injection non può fare danni oltre alla risposta stessa; limite di 20 Rules Question al giorno per User, applicato lato server; con un tetto di spesa sulle API.
- Se il regolamento crescesse oltre una dimensione ragionevole per il contesto, questa decisione va rivista.
