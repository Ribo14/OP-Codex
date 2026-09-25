import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { captureInstallPrompt } from './app/install'
import { startErrorReporting } from './lib/error-reporting'

// Prima del primo disegno: Chrome può offrire l'installazione subito dopo il caricamento.
captureInstallPrompt()
// Errori su Sentry, solo se configurato (RIB-35).
startErrorReporting()

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root mancante in index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
