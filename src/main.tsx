import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { captureInstallPrompt } from './app/install'

// Prima del primo disegno: Chrome può offrire l'installazione subito dopo il caricamento.
captureInstallPrompt()

const root = document.getElementById('root')
if (!root) throw new Error('Elemento #root mancante in index.html')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
