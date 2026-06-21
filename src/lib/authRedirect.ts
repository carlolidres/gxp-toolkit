/** OAuth / magic-link callback target — must match Supabase redirect allow list. */
export function getAuthRedirectUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  const path = base.startsWith('http')
    ? base
    : `${window.location.origin}${base.startsWith('/') ? base : `/${base}`}`

  return path.endsWith('/') ? path : `${path}/`
}
