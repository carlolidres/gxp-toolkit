import type { AuthUser } from '../types/auth'

export const mockUsers: AuthUser[] = [
  { id: 'u-1', name: 'Avery Morgan', email: 'admin@example.com', role: 'Admin', initials: 'AM' },
  { id: 'u-2', name: 'Jordan Lee', email: 'manager@example.com', role: 'Manager', initials: 'JL' },
  { id: 'u-3', name: 'Sam Rivera', email: 'editor@example.com', role: 'Editor', initials: 'SR' },
  { id: 'u-4', name: 'Taylor Chen', email: 'viewer@example.com', role: 'Viewer', initials: 'TC' },
]

