import { useMemo } from 'react'

import type { ProcessSpecification } from '../types/statistics'
import { buildStatisticalAlerts, calculateSummary, controlLimits } from '../utils/statistics'

export function useStatistics(values: number[], specification: ProcessSpecification) {
  return useMemo(() => ({
    summary: calculateSummary(values, specification),
    limits: controlLimits(values),
    alerts: buildStatisticalAlerts(values, specification),
  }), [specification, values])
}

