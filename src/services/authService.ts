import { mockUsers } from '../data/mockAuth'
import type { AuthUser, LoginCredentials } from '../types/auth'

const SESSION_KEY = 'gxp-toolkit-user'

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthUser> {
    await new Promise((resolve) => setTimeout(resolve, 350))
    const user = mockUsers.find((candidate) => candidate.role === credentials.role) ?? mockUsers[0]
    const sessionUser = { ...user, email: credentials.email || user.email }
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser))
    return sessionUser
  },
  logout(): void {
    localStorage.removeItem(SESSION_KEY)
  },
  getCurrentUser(): AuthUser | null {
    const value = localStorage.getItem(SESSION_KEY)
    return value ? (JSON.parse(value) as AuthUser) : null
  },
}

