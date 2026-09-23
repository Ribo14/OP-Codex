import 'i18next'
import type { defaultNS, resources } from './index'

// Chiavi di traduzione tipizzate: una chiave inesistente è un errore di compilazione.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS
    resources: (typeof resources)['it']
  }
}
