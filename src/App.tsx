import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './app/routes'
import { ThemeProvider } from './app/ThemeProvider'
import { UpdatePrompt } from './app/UpdatePrompt'
import './i18n'

const router = createBrowserRouter(routes)

function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
      <UpdatePrompt />
    </ThemeProvider>
  )
}

export default App
