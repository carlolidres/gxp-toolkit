export type AuthCarouselSlide = {
  id: string
  title: string
  subtitle: string
  /** Accessible description of the visual (not shown as UI caption). */
  alt: string
  srcWebp: string
  srcJpeg: string
}

function asset(path: string): string {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${base}${path.replace(/^\//, '')}`
}

/** Shared GxP-themed slides for Login / Sign-Up story panels. */
export const AUTH_CAROUSEL_SLIDES: AuthCarouselSlide[] = [
  {
    id: 'quality-excellence',
    title: 'Built for Pharmaceutical Quality Excellence',
    subtitle: 'Quality systems tooling designed for regulated operations.',
    alt: 'Pharmaceutical manufacturing cleanroom with stainless steel process equipment',
    srcWebp: asset('auth-carousel/pharma-manufacturing.webp'),
    srcJpeg: asset('auth-carousel/pharma-manufacturing.jpg'),
  },
  {
    id: 'validation',
    title: 'Simplify Validation and Compliance',
    subtitle: 'Support process, cleaning, and computerized system validation work.',
    alt: 'Process and cleaning validation equipment with documentation materials',
    srcWebp: asset('auth-carousel/pharma-validation.webp'),
    srcJpeg: asset('auth-carousel/pharma-validation.jpg'),
  },
  {
    id: 'data-integrity',
    title: 'Protect Data Integrity',
    subtitle: 'Keep records organized, traceable, and ready for review.',
    alt: 'Controlled documents and workstation supporting data integrity practices',
    srcWebp: asset('auth-carousel/pharma-data-integrity.webp'),
    srcJpeg: asset('auth-carousel/pharma-data-integrity.jpg'),
  },
  {
    id: 'documentation',
    title: 'Strengthen GxP Documentation',
    subtitle: 'Route documents, capture signatories, and retain an audit trail.',
    alt: 'Quality documentation workspace with controlled folders and digital workflow',
    srcWebp: asset('auth-carousel/pharma-compliance.webp'),
    srcJpeg: asset('auth-carousel/pharma-compliance.jpg'),
  },
  {
    id: 'platform',
    title: 'Quality Systems in One Secure Platform',
    subtitle: 'Laboratory, QA, and compliance workflows in a shared toolkit.',
    alt: 'Pharmaceutical quality control laboratory instruments and sample vials',
    srcWebp: asset('auth-carousel/pharma-qc-lab.webp'),
    srcJpeg: asset('auth-carousel/pharma-qc-lab.jpg'),
  },
]

/** Auto-advance interval (ms). Within the requested 5–7s band. */
export const AUTH_CAROUSEL_INTERVAL_MS = 6000
