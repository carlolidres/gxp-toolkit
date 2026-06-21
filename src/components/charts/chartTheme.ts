import { useTheme } from '../../hooks/useTheme'

export interface ChartPalette {
  primary: string
  secondary: string
  accent: string
  limit: string
  spec: string
  grid: string
  axis: string
  fillSoft: string
  tooltipBg: string
  tooltipBorder: string
  tooltipText: string
  paretoLine: string
  series: string[]
  heatmapLow: string
  heatmapMid: string
  heatmapHigh: string
}

const LIGHT_PALETTE: ChartPalette = {
  primary: '#315d9a',
  secondary: '#167d83',
  accent: '#7451a6',
  limit: '#c94a42',
  spec: '#c4842a',
  grid: '#d8e0e8',
  axis: '#5a6d80',
  fillSoft: '#b8d4e8',
  tooltipBg: '#ffffff',
  tooltipBorder: '#dbe4ea',
  tooltipText: '#243b53',
  paretoLine: '#c94a42',
  series: ['#315d9a', '#167d83', '#c4842a', '#7451a6', '#c94a42'],
  heatmapLow: '#2d8f4e',
  heatmapMid: '#e0b35c',
  heatmapHigh: '#c94a42',
}

const DARK_PALETTE: ChartPalette = {
  primary: '#6ba3e8',
  secondary: '#4ec5cb',
  accent: '#a88bd4',
  limit: '#f08078',
  spec: '#e0b35c',
  grid: '#333333',
  axis: '#a8a8a8',
  fillSoft: '#2a4a5e',
  tooltipBg: '#1e1e1e',
  tooltipBorder: '#3a3a3a',
  tooltipText: '#ececec',
  paretoLine: '#f08078',
  series: ['#6ba3e8', '#4ec5cb', '#e0b35c', '#a88bd4', '#f08078'],
  heatmapLow: '#3a9d5c',
  heatmapMid: '#c9a832',
  heatmapHigh: '#f08078',
}

export function useChartPalette(): ChartPalette {
  const { isDark } = useTheme()
  return isDark ? DARK_PALETTE : LIGHT_PALETTE
}
