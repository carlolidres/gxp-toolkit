import type {
  RegistryValue,
  RoutingDocument,
  VrmsAppData,
  VrmsDashboardMetrics,
  VrmsRegistryType,
} from '../types/vrms'
import { VRMS_DEFAULT_REGISTRY } from '../lib/vrmsDefaults'
import {
  mockAuditEvents,
  mockRegistryValues,
  mockRoutingDocuments,
  mockVrmsProfiles,
} from './vrmsProductionData'

export { mockVrmsProfiles, mockRegistryValues, mockRoutingDocuments, mockAuditEvents }

export function buildRegistriesFromValues(
  values: RegistryValue[] = mockRegistryValues,
): Record<VrmsRegistryType, string[]> {
  const registries = Object.fromEntries(
    (Object.keys(VRMS_DEFAULT_REGISTRY) as VrmsRegistryType[]).map((type) => [type, [] as string[]]),
  ) as Record<VrmsRegistryType, string[]>

  values.forEach((row) => {
    if (!registries[row.registryType].includes(row.value)) {
      registries[row.registryType].push(row.value)
    }
  })

  return registries
}

export function buildMockVrmsAppData(
  documents: RoutingDocument[] = mockRoutingDocuments,
  user = 'carlolidres@gmail.com',
): VrmsAppData {
  return {
    documents,
    registries: buildRegistriesFromValues(),
    dashboard: buildVrmsDashboard(documents),
    user,
  }
}

export function buildVrmsDashboard(documents: RoutingDocument[]): VrmsDashboardMetrics {
  const today = new Date()
  const statusCounts: Record<string, number> = {}
  const signatoryStats: Record<
    string,
    {
      name: string
      signed: number
      pending: number
      completed: number
      durationMinutes: number
      durationSamples: number
    }
  > = {}

  documents.forEach((doc) => {
    const status = doc.status || 'Blank'
    statusCounts[status] = (statusCounts[status] || 0) + 1

    doc.signatories.forEach((item) => {
      const name = item.Name.trim()
      if (!name) return

      if (!signatoryStats[name]) {
        signatoryStats[name] = {
          name,
          signed: 0,
          pending: 0,
          completed: 0,
          durationMinutes: 0,
          durationSamples: 0,
        }
      }

      const stats = signatoryStats[name]
      if (item.Status === 'Signed') {
        stats.signed++
        stats.completed++
        const duration = parseDurationMinutes(item['Duration pending/signing time'])
        if (duration >= 0) {
          stats.durationMinutes += duration
          stats.durationSamples++
        }
      } else {
        stats.pending++
      }
    })
  })

  const routingDocs = documents.filter((doc) => doc.status === 'Routing')
  const recentDocs = [...documents].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const aging = routingDocs
    .map((doc) => daysBetween(doc.dateSent, today))
    .filter((days) => days >= 0)

  return {
    total: documents.length,
    routing: statusCounts.Routing || 0,
    forScanning: statusCounts['For Scanning'] || 0,
    sent: statusCounts.Sent || 0,
    inEdms: statusCounts['In EDMS'] || 0,
    cancelled: statusCounts.Cancelled || 0,
    overdue: documents.filter((doc) => isVrmsOverdue(doc)).length,
    avgAging: aging.length ? Math.round(aging.reduce((a, b) => a + b, 0) / aging.length) : 0,
    statusCounts,
    kpi: Object.values(signatoryStats)
      .map((item) => ({
        name: item.name,
        signed: item.signed,
        avgDuration: item.durationSamples
          ? humanDuration(Math.round(item.durationMinutes / item.durationSamples))
          : 'N/A',
        avgDurationMinutes: item.durationSamples
          ? Math.round(item.durationMinutes / item.durationSamples)
          : -1,
        pending: item.pending,
        completed: item.completed,
      }))
      .sort((a, b) => b.signed - a.signed || a.name.localeCompare(b.name)),
    recentTotal: recentDocs.length,
    activeTotal: routingDocs.length,
    recent: recentDocs,
    active: [...routingDocs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  }
}

function isVrmsOverdue(doc: RoutingDocument): boolean {
  if (!doc.targetCompletionDate) return false
  if (['Sent', 'In EDMS', 'Cancelled'].includes(doc.status)) return false

  const target = new Date(doc.targetCompletionDate)
  const today = new Date()
  target.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return target < today
}

function daysBetween(start: string, end: Date): number {
  if (!start) return -1
  const startDate = new Date(start)
  if (Number.isNaN(startDate.getTime())) return -1
  return Math.floor((end.getTime() - startDate.getTime()) / 86_400_000)
}

function parseDurationMinutes(value: string): number {
  const text = value.trim().toLowerCase()
  if (!text) return -1

  const matches = [...text.matchAll(/(\d+)\s*(days?|hrs?|hours?|mins?|minutes?)/g)]
  if (!matches.length) return -1

  return matches.reduce((total, match) => {
    const amount = Number(match[1])
    const unit = match[2]
    if (unit.startsWith('day')) return total + amount * 1440
    if (unit.startsWith('hr') || unit.startsWith('hour')) return total + amount * 60
    return total + amount
  }, 0)
}

function humanDuration(minutes: number): string {
  let remaining = Math.max(0, Number(minutes) || 0)
  const days = Math.floor(remaining / 1440)
  remaining -= days * 1440
  const hours = Math.floor(remaining / 60)
  remaining -= hours * 60
  const parts: string[] = []
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`)
  if (hours) parts.push(`${hours} ${hours === 1 ? 'hr' : 'hrs'}`)
  if (remaining || !parts.length) parts.push(`${remaining} ${remaining === 1 ? 'min' : 'mins'}`)
  return parts.slice(0, 2).join(' ')
}
