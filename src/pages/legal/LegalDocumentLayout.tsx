import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

import { GxpLogo } from '../../components/brand/GxpLogo'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import '../login-page.css'

type LegalDocumentLayoutProps = {
  title: string
  lead: string
  children: ReactNode
}

export function LegalDocumentLayout({ title, lead, children }: LegalDocumentLayoutProps) {
  return (
    <div className="auth-legal-page">
      <article className="auth-legal-card">
        <GxpLogo variant="lockup" showTagline className="auth-legal-brand" />
        <h1>{title}</h1>
        <p className="auth-legal-lead">{lead}</p>
        <p className="auth-legal-lead">
          This page is an operational draft for sandbox use. It is not legal advice and has not been
          reviewed by counsel. Live Paddle billing stays off until the owner completes legal review.
        </p>
        {children}
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
