function resolveAppBaseUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/'
  const path = base.startsWith('http')
    ? base
    : `${window.location.origin}${base.startsWith('/') ? base : `/${base}`}`

  return path.endsWith('/') ? path : `${path}/`
}

/** OAuth / magic-link callback target — must match Supabase redirect allow list. */
export function getAuthRedirectUrl(): string {
  return resolveAppBaseUrl()
}

/** Password recovery redirect — Supabase appends recovery tokens to the URL hash. */
export function getPasswordResetRedirectUrl(): string {
  return resolveAppBaseUrl()
}
