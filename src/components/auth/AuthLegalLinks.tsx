import { Link } from 'react-router-dom'

type AuthLegalLinksProps = {
  className?: string
}

/** Shared legal / policy links for authentication pages. */
export function AuthLegalLinks({ className }: AuthLegalLinksProps) {
  return (
    <nav
      className={`gxp-auth-legal${className ? ` ${className}` : ''}`}
      aria-label="Legal"
    >
      <Link to="/privacy" className="gxp-auth-legal-link">
        Privacy Notice
      </Link>
      <span className="gxp-auth-legal-sep" aria-hidden>
        ·
      </span>
      <Link to="/terms" className="gxp-auth-legal-link">
        Terms of Use
      </Link>
    </nav>
  )
}
