import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './app/routes'
import { ThemeProvider } from './app/ThemeProvider'
import './i18n'

const router = createBrowserRouter(routes)

function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}

export default App
