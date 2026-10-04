export const PRODUCT_PROFILE_SECTIONS = [
  { id: 'raw-material', label: 'Raw Material' },
  { id: 'packaging-material', label: 'Packaging Material' },
  { id: 'in-process-control', label: 'In-process Control' },
  { id: 'analytical-report', label: 'Analytical Report' },
  { id: 'stability', label: 'Stability' },
  { id: 'holding-time', label: 'Holding-Time' },
  { id: 'other-data', label: 'Other Data' },
  { id: 'deviation-report', label: 'Deviation Report' },
  { id: 'product-complaints', label: 'Product Complaints' },
] as const

export type ProductProfileSectionId = (typeof PRODUCT_PROFILE_SECTIONS)[number]['id']

export function isProductProfileSection(value: string): value is ProductProfileSectionId {
  return PRODUCT_PROFILE_SECTIONS.some((section) => section.id === value)
}

export function productProfilePath(productCode: string, section: ProductProfileSectionId = 'raw-material'): string {
  return `/cpv/products/${encodeURIComponent(productCode)}/profile/${section}`
}

export function matchProductProfile(pathname: string): { productCode: string; section: string } | null {
  const match = pathname.match(/^\/cpv\/products\/([^/]+)\/profile(?:\/([^/]+))?\/?$/)
  if (!match) return null
  return {
    productCode: decodeURIComponent(match[1]),
    section: match[2] ? decodeURIComponent(match[2]) : 'raw-material',
  }
}
