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

- Circa 5.000 immagini in WebP occupano circa 250 MB dei 1 GB gratuiti di Storage; il traffico gratuito è 5 GB al mese più 5 GB dalla cache.
- Il primo scaricamento completo richiede ore di richieste lente: va distribuito su più notti, rispettando le regole di cortesia del Catalog Sync (ADR-0004). Poi si scaricano solo le Printing nuove.
- Tutti gli URL delle immagini sono generati da un'unica funzione (`cardImageUrl`); in sviluppo passa dal proxy di Vite finché il DB locale non ha le sue copie.
- La Content-Security-Policy deve consentire il dominio di Supabase Storage invece di quello ufficiale.
- Il rischio di copyright resta lo stesso dei link diretti; le immagini restano quelle con "SAMPLE".
