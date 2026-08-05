/** Shared PDF preview zoom bounds for eDoc document/workspace viewers. */
export const EDOC_PDF_BASE_WIDTH = 640
export const EDOC_PDF_ZOOM_MIN = 0.5
export const EDOC_PDF_ZOOM_MAX = 2
export const EDOC_PDF_ZOOM_STEP = 0.25

export function clampEdocPdfZoom(zoom: number): number {
  const stepped = Math.round(zoom * 100) / 100
  return Math.min(EDOC_PDF_ZOOM_MAX, Math.max(EDOC_PDF_ZOOM_MIN, stepped))
}

export function edocPdfRenderWidth(zoom: number): number {
  return Math.round(EDOC_PDF_BASE_WIDTH * clampEdocPdfZoom(zoom))
}

export function formatEdocPdfZoomPercent(zoom: number): string {
  return `${Math.round(clampEdocPdfZoom(zoom) * 100)}%`
}
