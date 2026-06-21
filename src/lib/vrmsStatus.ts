import type { VrmsDocumentStatus } from '../types/vrms'

export interface VrmsStatusStyle {
  color: string
  background: string
  text: string
  border: string
}

export const VRMS_STATUS_PALETTE: Record<string, VrmsStatusStyle> = {
  routing: { color: '#f59e0b', background: '#fff0c2', text: '#8a5400', border: '#ffd86e' },
  completed: { color: '#10b981', background: '#d6f7e8', text: '#08734d', border: '#8ce8b6' },
  fullysigned: { color: '#10b981', background: '#d6f7e8', text: '#08734d', border: '#8ce8b6' },
  forscanning: { color: '#8b5cf6', background: '#eee5ff', text: '#6941a8', border: '#d7c4ff' },
  sent: { color: '#22c55e', background: '#dcfce7', text: '#166534', border: '#a7f3c5' },
  inedms: { color: '#3b82f6', background: '#dbeafe', text: '#1d4f9a', border: '#b7cdfb' },
  returnedto: { color: '#64748b', background: '#eef3f6', text: '#475b68', border: '#d4e0e6' },
  cancelled: { color: '#ef4444', background: '#ffdada', text: '#b42318', border: '#ffaaa7' },
  blank: { color: '#94a3b8', background: '#f1f5f9', text: '#475569', border: '#d4dee8' },
}

export function getVrmsStatusKey(status: string): string {
  return String(status || 'blank').trim().toLowerCase().replace(/\s+/g, '')
}

export function getVrmsStatusStyle(status: string): VrmsStatusStyle {
  return VRMS_STATUS_PALETTE[getVrmsStatusKey(status)] ?? VRMS_STATUS_PALETTE.blank
}

export const VRMS_DASHBOARD_CARD_TONES = [
  'tone-teal',
  'tone-yellow',
  'tone-purple',
  'tone-green',
  'tone-blue',
  'tone-red',
  'tone-orange',
  'tone-cyan',
] as const

export const VRMS_STATUS_ORDER: VrmsDocumentStatus[] = [
  'Routing',
  'Completed',
  'Fully Signed',
  'For Scanning',
  'Sent',
  'In EDMS',
  'Returned to',
  'Cancelled',
  'Blank',
]
