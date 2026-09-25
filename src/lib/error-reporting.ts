import type { ErrorEvent } from '@sentry/browser'

// Segnalazione degli errori a Sentry (RIB-35): solo gli errori, senza dati personali.
// - Nessun utente, IP, cookie o intestazione; niente breadcrumb (clic, testi, console, richieste).
// - Negli indirizzi restano solo le pagine: via query e frammento, e i token degli Share Link e gli
//   id dei Deck diventano segnaposto.
// - Niente tracing, replay o sessioni.
// Si attiva solo se c'è VITE_SENTRY_DSN, e la libreria si carica solo in quel caso: senza DSN l'app
// non scarica una riga di Sentry.

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi

/** Un indirizzo senza dati: niente query né frammento, token e id sostituiti da segnaposto. */
export function scrubUrl(url: string): string {
  const [withoutHash = ''] = url.split('#')
  const [path = ''] = withoutHash.split('?')
  return path.replace(/\/m\/[A-Za-z0-9_-]+/, '/m/:token').replace(UUID, ':id')
}

/** L'evento come parte verso Sentry: solo errore, pagina e pila delle chiamate. */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  delete event.user
  delete event.breadcrumbs
  delete event.extra
  if (event.request) {
    event.request = event.request.url ? { url: scrubUrl(event.request.url) } : {}
  }
  for (const exception of event.exception?.values ?? []) {
    for (const frame of exception.stacktrace?.frames ?? []) {
      if (frame.abs_path) frame.abs_path = scrubUrl(frame.abs_path)
      if (frame.filename) frame.filename = scrubUrl(frame.filename)
    }
  }
  return event
}

export function startErrorReporting(dsn: string | undefined = import.meta.env.VITE_SENTRY_DSN) {
  if (!dsn) return
  void import('@sentry/browser').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      // Nessun dato raccolto oltre all'errore (in più, beforeSend ripulisce comunque l'evento).
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        stackFrameVariables: false,
      },
      sendClientReports: false,
      // Senza la sessione del browser (pagine viste): servono solo gli errori.
      integrations: (defaults) => defaults.filter((i) => i.name !== 'BrowserSession'),
      beforeBreadcrumb: () => null,
      beforeSend: scrubEvent,
    })
  })
}
