import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { GxpLogo } from '../components/brand/GxpLogo'
import { APP_NAME } from '../config/appNavigation'
import { iconSize, iconStroke } from '../theme/iconSizes'
import './login-page.css'

export function TermsOfUsePage() {
  return (
    <div className="auth-legal-page">
      <article className="auth-legal-card">
        <GxpLogo variant="lockup" showTagline className="auth-legal-brand" />
        <h1>Terms of Use</h1>
        <p className="auth-legal-lead">
          These terms describe acceptable use of {APP_NAME} for authorized users of this deployment.
          They do not assert that the application is certified or validated for any particular regulation.
        </p>
        <section>
          <h2>Authorized use</h2>
          <p>
            Use the application only with credentials issued to you, for legitimate business purposes approved by
            your organization, and in accordance with applicable internal procedures.
          </p>
        </section>
        <section>
          <h2>Accounts and security</h2>
          <p>
            Protect your password and session. Do not attempt to bypass access controls, inspect another user&apos;s
            private data without authorization, or disrupt service availability.
          </p>
        </section>
        <section>
          <h2>Records and audit</h2>
          <p>
            Actions taken in the application may be recorded for operational, quality, and security review according
            to your organization&apos;s policies.
          </p>
        </section>
        <section>
          <h2>No regulatory claim</h2>
          <p>
            Availability of {APP_NAME} features does not by itself constitute compliance with GxP, 21 CFR Part 11,
            Annex 11, or any other regulatory framework. Validation and compliance determinations remain the
            responsibility of the deploying organization.
          </p>
        </section>
        <p className="auth-legal-back">
          <Link to="/login" className="gxp-auth-text-link inline-flex items-center gap-1.5">
            <ArrowLeft size={iconSize.xs} strokeWidth={iconStroke} aria-hidden />
            Return to Login
          </Link>
        </p>
      </article>
    </div>
  )
}
