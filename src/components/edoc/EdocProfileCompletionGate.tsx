import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { getEdocAccessProfileCompleteness } from '../../lib/edocAccessProfileCompleteness'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import { EdocPage } from './EdocComponents'

/** Blocks create/send/sign/approve flows until organization + e-signature are complete. */
export function EdocProfileCompletionGate({
  title = 'Complete your profile',
  children,
  mode = 'block',
}: {
  title?: string
  children: ReactNode
  /** block = replace page content; banner = show alert above children */
  mode?: 'block' | 'banner'
}) {
  const { user } = useAuth()
  const completeness = getEdocAccessProfileCompleteness(user)

  if (completeness.complete) return <>{children}</>

  const prompt = (
    <div className="edoc-profile-gate panel" role="alertdialog" aria-labelledby="edoc-profile-gate-title">
      <div className="edoc-profile-gate-icon" aria-hidden>
        <AlertTriangle size={iconSize.lg} strokeWidth={iconStroke} />
      </div>
      <h2 id="edoc-profile-gate-title">{title}</h2>
      <p>{completeness.reminderMessage}</p>
      <ul>
        {completeness.missingLabels.map((label) => (
          <li key={label}>{label}</li>
        ))}
      </ul>
      <p className="help-text">
        Creating, sending, signing, approving, and externally authorizing documents is paused until these are
        completed.
      </p>
      <Link className="button primary" to="/account">
        Open Account Settings
      </Link>
    </div>
  )

  if (mode === 'banner') {
    return (
      <>
        <div className="edoc-profile-gate-banner" role="alert">
          <AlertTriangle size={iconSize.sm} strokeWidth={iconStroke} aria-hidden />
          <span>{completeness.reminderMessage}</span>
          <Link to="/account">Complete profile</Link>
        </div>
        {children}
      </>
    )
  }

  return (
    <EdocPage title={title} description="Organization and electronic signature are required for eDocuSign actions.">
      {prompt}
    </EdocPage>
  )
}

export function useEdocAccessProfileReady(): boolean {
  const { user } = useAuth()
  return getEdocAccessProfileCompleteness(user).complete
}
