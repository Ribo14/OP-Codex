import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import it from './it.json'

// Interfaccia in italiano; per aggiungere una lingua basta un altro file come it.json.
export const defaultNS = 'translation'
export const resources = { it: { translation: it } } as const

void i18n.use(initReactI18next).init({
  lng: 'it',
  fallbackLng: 'it',
  resources,
  interpolation: { escapeValue: false }, // React fa già l'escape
  returnNull: false,
})

export default i18n
