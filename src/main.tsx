import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'

import { App } from './app/App'
import { AuthProvider } from './hooks/useAuth'
import { PermissionsProvider } from './hooks/usePermissions'
import { ThemeProvider } from './hooks/useTheme'
import { ToastProvider } from './components/feedback/ToastProvider'
import './styles/globals.css'
import './styles/multiform-project.css'
import './styles/vrms.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <PermissionsProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </PermissionsProvider>
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  </StrictMode>,
)

