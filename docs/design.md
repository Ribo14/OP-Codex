# Design di OP-Codex

Decisioni di stile e di impaginazione prese con il prototipo di RIB-8. Le schermate vere le seguono.

Il prototipo completo, con le quattro varianti confrontate (A Galleria, B Archivio, C Raccoglitore, D Sintesi), è sul branch `prototype/rib-8`. È un archivio da consultare, non codice da riusare.

## Principi

- **Le carte sono protagoniste.** L'interfaccia è neutra e si fa da parte: le immagini delle carte sono già molto colorate.
- **Telefono e desktop sono entrambi di prima classe.** Sul telefono si usa con una mano; sul desktop si usa come un normale sito, con mouse e tastiera, sfruttando la larghezza.
- **Lo stesso contenuto, l'impaginazione giusta per il contesto.** Sfogliare vuole immagini grandi; cercare e costruire un Deck vuole dati densi.

## Token

Definiti in `src/index.css` e usati dal tema Tailwind/shadcn.

| Token            | Valore                                                                                              | Uso                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Palette          | neutra di shadcn (`neutral`), chiara e scura                                                        | sfondi, testo, bordi                                                                            |
| `--radius`       | `1rem`                                                                                              | angoli morbidi; le carte usano `rounded-xl`                                                     |
| `--color-game-*` | red `#d33a2c`, green `#1f9d55`, blue `#2563eb`, purple `#7c3aed`, black `#3f3f46`, yellow `#e0a800` | **solo accenti**: pallini dei colori, barretta sotto le miniature, etichette. Mai sfondi estesi |
| Font             | Geist Variable (self-hosted)                                                                        | tutto il testo; numeri con `tabular-nums`                                                       |

Il tema segue il sistema, con scelta manuale chiaro/scuro.

## Impaginazione

Punto di svolta: **`lg` (1024 px)**. Sotto è "telefono/tablet", sopra è "desktop".

| Elemento       | Telefono                                                      | Desktop                                                                                                                                                           |
| -------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigazione    | barra in basso (Catalogo, Mazzi, Collezione, Regole, Profilo) | barra laterale a sinistra, con il tema in fondo                                                                                                                   |
| Ricerca        | in alto, sempre visibile                                      | in alto, sempre visibile                                                                                                                                          |
| Catalogo       | interruttore **Griglia / Elenco**; griglia predefinita        | stesso interruttore; la scelta è ricordata sul dispositivo                                                                                                        |
| Griglia        | 2–4 colonne, carte grandi, nome e codice sotto                | 4–6 colonne, sollevamento al passaggio del mouse                                                                                                                  |
| Elenco         | miniatura, nome, codice, colori, costo, potenza               | colonne: miniatura, codice, nome, categoria, costo, potenza, counter, rarità                                                                                      |
| Dettaglio Card | **a tutto schermo**, chiusura in alto a destra                | **pannello affiancato** (~440 px) a griglia o elenco: si passa da una carta all'altra senza chiudere; con il pannello aperto l'elenco nasconde codice e categoria |
| Printing       | miniature sotto l'immagine grande                             | come su telefono                                                                                                                                                  |

Nel dettaglio: immagine grande su fondo leggermente scuro, poi nome, colori e Type come etichette, statistiche in riquadri (Vita, Costo, Potenza, Counter), Effetto e Trigger.

L'impaginazione "da album" della variante C (intestazione grande del Set, carte raggruppate per Category) è riservata alle **pagine dei Set e della Collection** (fase 2, Set Completion).

## Accessibilità

- Tutto raggiungibile da tastiera, con il focus visibile; `Esc` chiude il dettaglio.
- Nessuna funzione solo touch o solo hover.
- Le immagini hanno il nome della carta come testo alternativo; le Printing senza immagine mostrano un segnaposto con il nome.
