import { ShieldCheck } from 'lucide-react'

import { APP_NAME, APP_TAGLINE } from '../../config/appNavigation'
import { iconSize, iconStroke } from '../../theme/iconSizes'
import logoFull from '../../assets/branding/gxp-logo-full.svg'
import logoFullLight from '../../assets/branding/gxp-logo-full-light.svg'
import logoMark from '../../assets/branding/gxp-logo-mark.svg'

type GxpLogoVariant = 'full' | 'mark' | 'lockup'
type GxpLogoTone = 'light' | 'default'

export function GxpLogo({
  variant = 'full',
  tone = 'default',
  className = '',
  showTagline = false,
}: {
  variant?: GxpLogoVariant
  tone?: GxpLogoTone
  className?: string
  showTagline?: boolean
}) {
  if (variant === 'lockup') {
    return (
      <span className={['gxp-brand-lockup', className].filter(Boolean).join(' ')}>
        <span className="gxp-brand-mark" aria-hidden="true">
          <ShieldCheck size={iconSize.lg} strokeWidth={iconStroke} />
        </span>
        <span className="gxp-brand-lockup-text">
          <span className="gxp-brand-lockup-title">{APP_NAME}</span>
          {showTagline ? <span className="gxp-brand-lockup-sub">{APP_TAGLINE}</span> : null}
        </span>
      </span>
    )
  }

  const source =
    variant === 'mark' ? logoMark : tone === 'light' ? logoFullLight : logoFull
  const classes = ['gxp-logo', `gxp-logo-${variant}`, `gxp-logo-${tone}`, className].filter(Boolean).join(' ')

  return <img className={classes} src={source} alt={APP_NAME} />
}

/** Compact Lucide-style mark used in favicon-adjacent and loading contexts. */
export function GxpBrandMark({
  size = iconSize.lg,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <span className={['gxp-brand-mark', className].filter(Boolean).join(' ')} aria-hidden="true">
      <ShieldCheck size={size} strokeWidth={iconStroke} />
    </span>
  )
}
