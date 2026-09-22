# Immagini delle carte caricate dal sito ufficiale, non copiate

Le immagini delle Printing si caricano direttamente dagli URL ufficiali (`/images/cardlist/card/{PrintID}.png`) e il service worker le mette in cache sul dispositivo. Copiarle nel nostro storage (circa 5.000 immagini, 300–400 MB in WebP) avrebbe saturato lo storage e la banda del piano gratuito di Supabase. Il rischio di copyright resta lo stesso in entrambi i casi.

## Consequences

- Tutti gli URL delle immagini sono generati da un'unica funzione: passare a uno storage nostro deve voler dire cambiare solo quella.
- Se Bandai cambia gli URL, le immagini si rompono finché non aggiorniamo la funzione.
- La Content-Security-Policy deve consentire il dominio delle immagini ufficiali.
