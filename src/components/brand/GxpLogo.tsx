import logoFull from '../../assets/branding/gxp-logo-full.svg'
import logoFullLight from '../../assets/branding/gxp-logo-full-light.svg'
import logoMark from '../../assets/branding/gxp-logo-mark.svg'

type GxpLogoVariant = 'full' | 'mark'
type GxpLogoTone = 'light' | 'default'

export function GxpLogo({
  variant = 'full',
  tone = 'default',
  className = '',
}: {
  variant?: GxpLogoVariant
  tone?: GxpLogoTone
  className?: string
}) {
  const source =
    variant === 'mark' ? logoMark : tone === 'light' ? logoFullLight : logoFull
  const classes = ['gxp-logo', `gxp-logo-${variant}`, `gxp-logo-${tone}`, className].filter(Boolean).join(' ')

  return <img className={classes} src={source} alt="GxP Toolkit" />
}
