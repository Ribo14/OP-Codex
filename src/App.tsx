import { CatalogPage } from './catalog/CatalogPage'
import { Prototype } from './prototype/rib8/Prototype'

function App() {
  // PROTOTIPO RIB-8: solo sul branch prototype/rib-8, con VITE_PROTOTYPE=true.
  if (import.meta.env.VITE_PROTOTYPE === 'true') return <Prototype />

  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold tracking-tight">OP-Codex</h1>
      <CatalogPage />
    </main>
  )
}

export default App
