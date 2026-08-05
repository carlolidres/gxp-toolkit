import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { GxpLogo } from '../components/brand/GxpLogo'
import { APP_NAME } from '../config/appNavigation'
import { iconSize, iconStroke } from '../theme/iconSizes'
import './login-page.css'

export function PrivacyNoticePage() {
  return (
    <div className="auth-legal-page">
      <article className="auth-legal-card">
        <GxpLogo variant="lockup" showTagline className="auth-legal-brand" />
        <h1>Privacy Notice</h1>
        <p className="auth-legal-lead">
          This notice describes how {APP_NAME} handles account and usage information in this application.
          It is an operational summary for users of this toolkit and is not legal advice.
        </p>
        <section>
          <h2>Information we process</h2>
          <p>
            Depending on how the environment is configured, the application may process account details such as
            name, email address, organization, job title, authentication events, and activity needed to deliver
            routing, document, and audit features.
          </p>
        </section>
        <section>
          <h2>How information is used</h2>
          <p>
            Information is used to authenticate users, provide requested features, maintain security controls,
            support operational audit trails, and improve reliability of the service.
          </p>
        </section>
        <section>
          <h2>Security</h2>
          <p>
            Access is restricted to authenticated users according to assigned permissions. Credentials and tokens
            are handled by the configured authentication provider and must not be shared.
          </p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>
            For privacy questions about this deployment, contact your organization&apos;s administrator for {APP_NAME}.
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
