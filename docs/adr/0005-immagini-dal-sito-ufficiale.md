# Immagini delle carte copiate in WebP su Supabase Storage

Le immagini delle Printing vengono scaricate dal sito ufficiale (`/images/cardlist/card/{PrintID}.png`) dal Catalog Sync, convertite in WebP e salvate su Supabase Storage. L'app le carica da lì e il service worker le mette in cache sul dispositivo. Si scaricano **tutte**, non solo quelle richieste: l'app deve essere fluida fin dalla prima apertura.

## Context

In origine avevamo deciso di caricare le immagini direttamente dagli URL ufficiali, senza copiarle. Durante RIB-9 abbiamo scoperto che:

- il sito ufficiale risponde con `Cross-Origin-Resource-Policy: same-site`, quindi i browser rifiutano di mostrare le sue immagini su un altro dominio (verificato con Chrome; nemmeno il service worker può aggirarlo);
- il server ufficiale impiega 3–8 secondi per immagine (PNG da 150–200 KB);
- tutte le immagini ufficiali riportano la scritta "SAMPLE".

## Considered Options

- **Link diretto al sito ufficiale**: impossibile per la Cross-Origin-Resource-Policy.
- **Proxy con Cloudflare Worker**: gratuito e senza copie, ma la prima visualizzazione resta lenta, i PNG restano pesanti e serve un nuovo account con il suo segreto.
- **Proxy tramite Netlify**: il traffico costa 20 crediti per GB, insostenibile con 300 crediti al mese.
- **Immagini da siti della community** (senza "SAMPLE"): licenza incerta, scartate.

## Consequences

- Per ogni Printing salviamo due versioni ricavate dallo stesso download: una miniatura da 300 px per la griglia (circa 27 KB) e l'immagine completa da 600 px per il dettaglio (circa 80 KB). Con circa 5.000 Printing sono circa 535 MB dei 1 GB gratuiti di Storage.
- Sfogliare tutto il catalogo costa circa 135 MB di traffico per dispositivo (solo miniature); il traffico gratuito è 5 GB al mese più 5 GB dalla cache.
- Il primo scaricamento completo richiede ore di richieste lente: va distribuito su più notti, rispettando le regole di cortesia del Catalog Sync (ADR-0004). Poi si scaricano solo le Printing nuove.
- Tutti gli URL delle immagini sono generati da un'unica funzione (`cardImageUrl`). Anche in sviluppo le immagini arrivano dallo Storage locale, dopo `npm run sync:images`.
- La Content-Security-Policy deve consentire il dominio di Supabase Storage invece di quello ufficiale.
- Offline (RIB-16): il service worker tiene le immagini viste in due cache CacheFirst con un limite di voci (6.000 miniature e 6.000 immagini grandi, abbastanza per tutto il catalogo; `src/catalog/image-caches.ts`), e l'utente può scaricare in anticipo le immagini di un Set o, dalle Impostazioni (RIB-37), tutte quelle del catalogo (circa 550 MB), con interruzione, ripresa ed eliminazione. Le `<img>` usano `crossOrigin="anonymous"` (lo Storage risponde con `Access-Control-Allow-Origin: *`), così la cache salva risposte CORS e non risposte opache, che il browser conterebbe molto più grandi del vero.
- Il rischio di copyright resta lo stesso dei link diretti; le immagini restano quelle con "SAMPLE".
