// Glossario delle Keyword e dei concetti di regola (RIB-51). Testi in italiano scritti a partire
// dalle Comprehensive Rules (docs/Regole One Piece Card/rule_comprehensive.pdf); `rule` è il
// numero della regola di riferimento. Il nome resta quello inglese, come sulle carte.
// Nessuna AI nell'app (ADR-0006): chi aggiorna il regolamento aggiorna anche questo file.

export type GlossaryGroup = 'effect' | 'timing' | 'concept'

export interface GlossaryEntry {
  /** Identificativo nell'URL (/regole?voce=blocker). */
  id: string
  /** Il nome come compare sulle carte. */
  term: string
  group: GlossaryGroup
  /** Numero della regola nelle Comprehensive Rules. */
  rule: string
  /** In una riga. */
  summary: string
  /** Spiegazione, un paragrafo per voce. */
  body: readonly string[]
}

export const GLOSSARY: readonly GlossaryEntry[] = [
  // ---- Keyword effect (10-1) ----
  {
    id: 'rush',
    term: 'Rush',
    group: 'effect',
    rule: '10-1-1',
    summary: 'Il Character può attaccare nel turno in cui viene giocato.',
    body: [
      'Di norma un Character giocato in questo turno non può attaccare. Con [Rush] può attaccare subito, sia il Leader sia i Character avversari.',
      'Se [Rush] è preceduto da una condizione (per esempio [DON!! x1]), vale solo quando la condizione è soddisfatta.',
    ],
  },
  {
    id: 'rush-character',
    term: 'Rush: Character',
    group: 'effect',
    rule: '10-1-6',
    summary:
      'Nel turno in cui viene giocato, il Character può attaccare solo i Character avversari.',
    body: [
      'È una versione limitata di [Rush]: il Character può attaccare nel turno in cui entra, ma solo i Character dell’avversario, non il Leader.',
    ],
  },
  {
    id: 'double-attack',
    term: 'Double Attack',
    group: 'effect',
    rule: '10-1-2',
    summary: 'Se l’attacco va a segno sul Leader, toglie 2 Vite invece di 1.',
    body: [
      'Quando questa carta vince un attacco contro il Leader avversario, i danni sono 2 invece di 1: l’avversario prende 2 carte dalla Vita (e per ognuna può attivare il [Trigger]).',
      'Se all’avversario resta 1 sola Vita, il primo danno toglie quella e il secondo non fa vincere la partita: si vince solo colpendo un Leader che ha già 0 Vite.',
    ],
  },
  {
    id: 'banish',
    term: 'Banish',
    group: 'effect',
    rule: '10-1-3',
    summary: 'La Vita tolta all’avversario va nel cestino invece che in mano, senza [Trigger].',
    body: [
      'Quando questa carta infligge danno al Leader avversario, la carta Vita non va nella mano dell’avversario ma direttamente nel suo cestino (trash).',
      'Il [Trigger] di quella carta non si può attivare.',
    ],
  },
  {
    id: 'blocker',
    term: 'Blocker',
    group: 'effect',
    rule: '10-1-4',
    summary: 'Mettendo a riposo questa carta, subisce lei l’attacco diretto a un’altra tua carta.',
    body: [
      'Quando l’avversario attacca il tuo Leader o un altro tuo Character, nel Block Step puoi mettere a riposo (rest) un tuo Character attivo con [Blocker]: l’attacco passa a lui.',
      'Si può attivare un solo [Blocker] per attacco. Un Character già a riposo non può bloccare.',
      'Attivando [Blocker] si attivano gli effetti [On Block] della carta che blocca.',
    ],
  },
  {
    id: 'unblockable',
    term: 'Unblockable',
    group: 'effect',
    rule: '10-1-7',
    summary: 'Quando attacca, l’avversario non può usare [Blocker].',
    body: [
      'Gli attacchi di questa carta non si possono bloccare: l’avversario non può attivare [Blocker]. Può comunque difendersi con i Counter.',
    ],
  },
  {
    id: 'trigger',
    term: 'Trigger',
    group: 'effect',
    rule: '10-1-5',
    summary: 'Quando la carta esce dalla tua Vita per un danno, puoi rivelarla e usarne l’effetto.',
    body: [
      'Quando subisci un danno e la carta presa dalla Vita ha [Trigger], puoi rivelarla e attivare il suo effetto [Trigger] invece di metterla in mano.',
      'Dopo l’effetto la carta va nel cestino, salvo che il testo dica altro (per esempio “aggiungi questa carta alla mano” o “gioca questa carta”).',
      'Puoi anche scegliere di non attivarlo: in quel caso la carta va in mano senza rivelarla.',
    ],
  },

  // ---- Keyword di tempo e condizioni (10-2) ----
  {
    id: 'on-play',
    term: 'On Play',
    group: 'timing',
    rule: '10-2-6',
    summary: 'L’effetto si attiva quando la carta viene giocata.',
    body: [
      'L’effetto parte nel momento in cui giochi la carta. Vale anche quando è un effetto a “giocarla” (per esempio dal cestino o dalla cima del mazzo).',
    ],
  },
  {
    id: 'when-attacking',
    term: 'When Attacking',
    group: 'timing',
    rule: '10-2-5',
    summary: 'L’effetto si attiva quando dichiari un attacco con questa carta.',
    body: [
      'Si attiva nell’Attack Step, subito dopo che hai dichiarato l’attacco con questa carta, prima che l’avversario possa bloccare o usare Counter.',
    ],
  },
  {
    id: 'on-block',
    term: 'On Block',
    group: 'timing',
    rule: '10-2-15',
    summary: 'L’effetto si attiva quando questa carta blocca con [Blocker].',
    body: ['Si attiva nel Block Step, quando attivi il [Blocker] di questa carta.'],
  },
  {
    id: 'on-opponents-attack',
    term: "On Your Opponent's Attack",
    group: 'timing',
    rule: '10-2-16',
    summary: 'L’effetto si attiva quando l’avversario dichiara un attacco.',
    body: [
      'Si attiva durante il turno avversario, quando l’avversario dichiara un attacco, dopo i suoi effetti [When Attacking].',
    ],
  },
  {
    id: 'on-ko',
    term: 'On K.O.',
    group: 'timing',
    rule: '10-2-17',
    summary: 'L’effetto si attiva quando questo Character viene messo K.O.',
    body: [
      'Quando il Character viene messo K.O. (in battaglia o da un effetto) si controllano le condizioni; l’effetto si attiva mentre è in campo, poi la carta va nel cestino e l’effetto si risolve da lì.',
      'Se la carta va nel cestino in un altro modo (per esempio “trash” o riportata in mano), non è un K.O. e [On K.O.] non si attiva.',
    ],
  },
  {
    id: 'activate-main',
    term: 'Activate: Main',
    group: 'timing',
    rule: '10-2-2',
    summary: 'Puoi usare l’effetto nella tua Main Phase, fuori dalle battaglie.',
    body: [
      'È un effetto che attivi tu, quando vuoi, durante la tua Main Phase ma non durante una battaglia. Spesso ha un costo (per esempio mettere a riposo la carta o DON!! −1).',
    ],
  },
  {
    id: 'main',
    term: 'Main',
    group: 'timing',
    rule: '10-2-3',
    summary: 'Evento che si usa nella tua Main Phase, fuori dalle battaglie.',
    body: [
      'Si trova solo sugli Event: paghi il costo e usi l’effetto durante la tua Main Phase, fuori dalle battaglie.',
      'Alcuni effetti, come il [Trigger], possono permettere di usarlo in altri momenti.',
    ],
  },
  {
    id: 'counter',
    term: 'Counter',
    group: 'timing',
    rule: '10-2-4',
    summary: 'Evento che si usa nel Counter Step, quando l’avversario ti attacca.',
    body: [
      'Si trova solo sugli Event: quando vieni attaccato, nel Counter Step paghi il costo dell’Event e lo usi, di solito per aumentare la potenza del Leader o di un Character attaccato.',
      'Non va confuso con il valore Counter stampato a lato dei Character (vedi “Counter (valore)”).',
    ],
  },
  {
    id: 'end-of-your-turn',
    term: 'End of Your Turn',
    group: 'timing',
    rule: '10-2-7',
    summary: 'L’effetto si attiva alla fine del tuo turno.',
    body: ['Si attiva nella End Phase del tuo turno.'],
  },
  {
    id: 'end-of-opponents-turn',
    term: "End of Your Opponent's Turn",
    group: 'timing',
    rule: '10-2-8',
    summary: 'L’effetto si attiva alla fine del turno avversario.',
    body: ['Si attiva nella End Phase del turno dell’avversario.'],
  },
  {
    id: 'your-turn',
    term: 'Your Turn',
    group: 'timing',
    rule: '10-2-11',
    summary: 'L’effetto vale solo durante il tuo turno.',
    body: ['È una condizione: l’effetto che segue è attivo solo mentre è il tuo turno.'],
  },
  {
    id: 'opponents-turn',
    term: "Opponent's Turn",
    group: 'timing',
    rule: '10-2-12',
    summary: 'L’effetto vale solo durante il turno avversario.',
    body: [
      'È una condizione: l’effetto che segue è attivo solo mentre è il turno dell’avversario.',
    ],
  },
  {
    id: 'once-per-turn',
    term: 'Once Per Turn',
    group: 'timing',
    rule: '10-2-13',
    summary: 'L’effetto si può usare una sola volta per turno.',
    body: [
      'Una volta risolto, l’effetto non si può riattivare nello stesso turno, anche se le condizioni tornano vere.',
      'Il limite vale per ogni copia: due carte uguali in campo possono usarlo una volta ciascuna.',
      'Se la carta lascia il campo e ci torna, conta come una carta nuova e può usarlo di nuovo.',
    ],
  },
  {
    id: 'don-x',
    term: 'DON!! xX',
    group: 'timing',
    rule: '10-2-9',
    summary: 'L’effetto vale se questa carta ha almeno X DON!! dati.',
    body: [
      'Per esempio [DON!! x1] vuol dire: l’effetto è attivo se alla carta è stato dato almeno 1 DON!!; [DON!! x2] almeno 2, e così via.',
      'I DON!! si danno nella tua Main Phase (vedi “Dare DON!!”).',
    ],
  },
  {
    id: 'don-minus',
    term: 'DON!! −X',
    group: 'timing',
    rule: '10-2-10',
    summary: 'Costo: rimetti X DON!! dal campo nel mazzo DON!!.',
    body: [
      'Per usare l’effetto scegli X carte DON!! tra quelle nella cost area, sul Leader e sui Character, e rimettile nel tuo mazzo DON!!.',
    ],
  },

  // ---- Concetti ----
  {
    id: 'ko',
    term: 'K.O.',
    group: 'concept',
    rule: '10-2-1',
    summary:
      'Un Character mandato nel cestino perdendo una battaglia o per un effetto che lo mette K.O.',
    body: [
      'Un Character è K.O. quando perde una battaglia o quando un effetto dice di metterlo K.O.: va dal campo al cestino del suo proprietario.',
      'Se finisce nel cestino in un altro modo, non conta come K.O.: non si attivano [On K.O.] e non valgono le protezioni del tipo “non può essere messo K.O.”.',
    ],
  },
  {
    id: 'trash',
    term: 'Trash',
    group: 'concept',
    rule: '10-2-14',
    summary: 'Scartare: mettere una carta dalla mano nel cestino.',
    body: [
      'Come istruzione (“trash 1 card from your hand”) vuol dire scegliere una carta dalla mano e metterla nel cestino. Il cestino è anche la zona degli scarti, visibile a tutti.',
    ],
  },
  {
    id: 'active-rested',
    term: 'Active / Rested',
    group: 'concept',
    rule: '4-4',
    summary: 'Attiva: carta in verticale. A riposo: carta girata in orizzontale.',
    body: [
      'Leader, Character, Stage e DON!! nella cost area sono attivi (in verticale) o a riposo (in orizzontale). Attaccare e pagare costi mettono le carte a riposo; all’inizio del tuo turno tornano attive.',
      'I DON!! dati a un Leader o a un Character non sono né attivi né a riposo.',
    ],
  },
  {
    id: 'give-don',
    term: 'Dare DON!!',
    group: 'concept',
    rule: '6-5-5',
    summary: 'Metti un DON!! attivo sotto Leader o Character: +1000 potenza nel tuo turno.',
    body: [
      'Nella tua Main Phase puoi prendere un DON!! attivo dalla cost area e metterlo sotto il Leader o un Character: ogni DON!! dato vale +1000 potenza durante il tuo turno.',
      'Serve anche per le condizioni [DON!! xX]. Quando la carta lascia il campo, i suoi DON!! tornano nella cost area a riposo.',
    ],
  },
  {
    id: 'life',
    term: 'Life',
    group: 'concept',
    rule: '2-9, 4-6',
    summary: 'Le carte coperte sotto il Leader: ogni danno ne sposta una in mano.',
    body: [
      'A inizio partita metti a faccia in giù tante carte dal mazzo quante indica la Vita del tuo Leader. Ogni danno al Leader sposta in mano la carta in cima alla Vita (con la possibilità di attivare il suo [Trigger]).',
      'Se il tuo Leader subisce danno quando hai 0 Vite, perdi la partita.',
    ],
  },
  {
    id: 'counter-value',
    term: 'Counter (valore)',
    group: 'concept',
    rule: '2-10, 7-1-3',
    summary: 'Il +1000/+2000 a lato dei Character: lo scarti dalla mano per difenderti.',
    body: [
      'Quando vieni attaccato, nel Counter Step puoi scartare dalla mano un Character con un valore Counter: il tuo Leader o il Character attaccato guadagna quella potenza fino alla fine della battaglia.',
      'Se ne possono usare quanti se ne vuole. Solo i Character hanno questo valore; gli Event usano invece la keyword [Counter].',
    ],
  },
]

const byId = new Map(GLOSSARY.map((entry) => [entry.id, entry]))

export function glossaryEntry(id: string): GlossaryEntry | undefined {
  return byId.get(id)
}

const byTerm = new Map(GLOSSARY.map((entry) => [entry.term.toLowerCase(), entry]))

/**
 * La voce di una Keyword come compare sulle carte o nel catalogo (senza parentesi quadre):
 * "Blocker", "DON!! x2", "On K.O.". Undefined se non c'è.
 */
export function entryForKeyword(keyword: string): GlossaryEntry | undefined {
  const term = keyword.trim().toLowerCase()
  if (/^don!! x\d+$/.test(term)) return byId.get('don-x')
  if (/^don!! [−-]\d+$/.test(term)) return byId.get('don-minus')
  return byTerm.get(term)
}

export const GLOSSARY_GROUPS: readonly GlossaryGroup[] = ['effect', 'timing', 'concept']
