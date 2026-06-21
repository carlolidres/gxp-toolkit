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
      } else {
        stats.pending++
      }
    })
  })

  const routingDocs = documents.filter((doc) => doc.status === 'Routing')
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
        avgDuration: 'N/A',
        avgDurationMinutes: item.durationSamples
          ? Math.round(item.durationMinutes / item.durationSamples)
          : -1,
        pending: item.pending,
        completed: item.completed,
      }))
      .sort((a, b) => b.signed - a.signed || a.name.localeCompare(b.name)),
    recent: [...documents]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8),
    active: [...routingDocs]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 12),
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
