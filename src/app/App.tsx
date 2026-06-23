import { AppRoutes } from './routes'
import { AuthRecoveryRedirect } from '../components/auth/AuthRecoveryRedirect'

export function App() {
  return (
    <>
      <AuthRecoveryRedirect />
      <AppRoutes />
    </>
  )
}

