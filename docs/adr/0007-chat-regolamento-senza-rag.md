# Chat sul regolamento con regolamento completo in contesto, senza RAG

Le Rules Question sono gestite da un modello economico (Claude Haiku 4.5) a cui passiamo l'intero testo delle Comprehensive Rules, tenuto in cache con il prompt caching. Non usiamo un sistema di ricerca semantica (embedding e vector store). Il documento è abbastanza piccolo da stare nel contesto, e averlo intero evita risposte sbagliate dovute a spezzoni recuperati male.

## Consequences

- Il modello non ha strumenti né accesso ai dati degli utenti: una prompt injection non può fare danni oltre alla risposta stessa.
- Limite di 20 Rules Question al giorno per User, applicato lato server.
- Se il regolamento crescesse oltre una dimensione ragionevole per il contesto, questa decisione va rivista.
