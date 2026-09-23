import { CatalogPage } from './catalog/CatalogPage'

function App() {
  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-4 p-4">
      <h1 className="text-2xl font-bold tracking-tight">OP-Codex</h1>
      <CatalogPage />
    </main>
  )
}

export default App
