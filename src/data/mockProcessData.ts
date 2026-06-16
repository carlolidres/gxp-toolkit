import type { ProcessPoint, ProcessSpecification } from '../types/statistics'

export const processSpecifications: ProcessSpecification[] = [
  { parameter: 'Assay', unit: '%', target: 100, lsl: 95, usl: 105 },
  { parameter: 'Weight', unit: 'mg', target: 500, lsl: 475, usl: 525 },
  { parameter: 'pH', unit: 'pH', target: 7, lsl: 6.5, usl: 7.5 },
  { parameter: 'Viscosity', unit: 'cP', target: 1200, lsl: 1050, usl: 1350 },
  { parameter: 'Hardness', unit: 'N', target: 85, lsl: 70, usl: 100 },
  { parameter: 'Thickness', unit: 'mm', target: 4.2, lsl: 3.9, usl: 4.5 },
  { parameter: 'Fill volume', unit: 'mL', target: 100, lsl: 98, usl: 102 },
  { parameter: 'Temperature', unit: '°C', target: 25, lsl: 20, usl: 30 },
]

const assayValues = [99.4, 100.2, 99.8, 101.1, 100.5, 98.9, 99.7, 100.4, 101.3, 100.8, 102.1, 101.6]

export const assayCorrelationLabels = ['Assay', 'Weight', 'pH', 'Visc', 'Hard', 'Fill', 'Temp']

/** Mock 7×7 correlation matrix for heat map gallery demos. */
export function buildMockCorrelationMatrix(): number[][] {
  const size = assayCorrelationLabels.length
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) => {
      if (row === col) return 1
      const distance = Math.abs(row - col)
      return Math.max(-0.35, 0.92 - distance * 0.22 + (row % 2 ? 0.05 : -0.03))
    }),
  )
}

export const initialProcessPoints: ProcessPoint[] = assayValues.map((value, index) => ({
  id: `p-${index + 1}`,
  parameter: 'Assay',
  batch: `B-${2401 + index}`,
  timestamp: new Date(2026, index, 5).toISOString(),
  value,
}))

