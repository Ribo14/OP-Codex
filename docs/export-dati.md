# Esporta i miei dati

"Esporta i miei dati" (Profilo → Account e sicurezza, RIB-28) scarica un file ZIP con tutti i
dati personali dell'utente: serve per il diritto di portabilità (GDPR) e come backup personale.

Il file si chiama `op-codex-<username>-<AAAA-MM-GG>.zip`.

## Contenuto

| File             | Formato                            | Contenuto                                                                                                                                                                  |
| ---------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `LEGGIMI.txt`    | testo                              | Descrizione breve dei file, per chi apre l'archivio.                                                                                                                       |
| `profilo.json`   | JSON                               | `{ version, exportedAt, profile: { username, email, createdAt, updatedAt } }`                                                                                              |
| `collezione.csv` | CSV UTF-8 con BOM, `;`, righe CRLF | Colonne: Print ID, Card Code, Nome, Set, Nome del Set, Lingua, Quantità. Una riga per Printing e lingua.                                                                   |
| `mazzi.json`     | JSON                               | `{ version, exportedAt, decks: [{ id, name, leaderCode, leaderPrintId, format, visibility, shareLink, createdAt, updatedAt, cards: [{ cardCode, quantity, printId }] }] }` |
| `mazzi/*.txt`    | Deck List (`4xOP01-016`, RIB-24)   | Un file per Deck, il Leader per primo. Si reimporta in OP-Codex o in OPTCG Sim.                                                                                            |

Nome e Set della Collection vengono dal catalogo sul dispositivo; una Printing non più nel catalogo
resta comunque nel file, con le colonne che si conoscono.

Il CSV usa `;` come separatore, quello che Excel in italiano si aspetta; Google Sheets lo
riconosce da solo. Il testo che inizia come una formula (`=`, `+`, `-`, `@`) si scrive con un
apice davanti, così aprire il file non esegue nulla.

## Regole

- L'export si prepara online e legge con i permessi dell'utente: le policy RLS del database più
  un filtro esplicito sull'utente, così i dati di altri (per esempio Deck visibili agli amici)
  non finiscono mai nel file.
- `version` cambia solo se cambia la forma dei file esistenti. Aggiungere un campo o un file non
  la cambia.
- **Nuovi dati personali** (amici, prezzi, preferenze…): chi li introduce li aggiunge anche qui, in
  `src/account/data-export.ts` (forma e file), `src/account/data-export-api.ts` (lettura) e
  in questa tabella.

## Download

Il file si prepara con un tocco e si consegna con un secondo tocco. Nella PWA installata di iOS si
apre la condivisione del sistema ("Salva su File"), perché lì un link di download apre
un'anteprima senza via d'uscita. Ovunque altro (computer, Android, Safari nel browser) è un
normale download: Chrome per Android non condivide file .zip (RIB-28, 2026-09-26). Se la
condivisione viene rifiutata, si ripiega comunque sul download.
