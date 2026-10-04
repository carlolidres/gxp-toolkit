import { Link } from 'react-router-dom'

/** Policy links for pricing and billing screens. Pages are public drafts pending counsel review. */
export function EdocBillingLegalLinks() {
  return (
    <nav className="mt-6 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[var(--muted)]" aria-label="Billing policies">
      <Link className="underline-offset-2 hover:text-[var(--navy)] hover:underline" to="/terms">
        Terms
      </Link>
      <Link className="underline-offset-2 hover:text-[var(--navy)] hover:underline" to="/privacy">
        Privacy
      </Link>
      <Link className="underline-offset-2 hover:text-[var(--navy)] hover:underline" to="/refunds">
        Refunds and cancellation
      </Link>
      <Link className="underline-offset-2 hover:text-[var(--navy)] hover:underline" to="/esign-consent">
        E-sign consent
      </Link>
    </nav>
  )
}
