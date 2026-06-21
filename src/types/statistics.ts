export interface ProcessPoint {
  id: string
  parameter: ProcessParameter
  batch: string
  timestamp: string
  value: number
}

export type ProcessParameter =
  | 'Assay'
  | 'Weight'
  | 'pH'
  | 'Viscosity'
  | 'Hardness'
  | 'Thickness'
  | 'Fill volume'
  | 'Temperature'

export interface ProcessSpecification {
  parameter: ProcessParameter
  unit: string
  target: number
  lsl: number
  usl: number
}

export interface StatisticalSummary {
  mean: number
  median: number
  standardDeviation: number
  minimum: number
  maximum: number
  cp: number
  cpk: number
  pp: number
  ppk: number
  outOfSpec: number
  outOfControl: number
  outOfTrend: number
}

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface StatisticalAlert {
  id: string
  severity: AlertSeverity
  title: string
  message: string
}

