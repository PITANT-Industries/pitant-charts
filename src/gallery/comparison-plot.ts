import type { ChartExample } from '../types'

const widePlots = new Set([
  'line-default', 'line-threshold', 'area-default', 'area-forecast', 'area-reference-band',
  'area-reference-range', 'area-trend', 'bar-default', 'bar-stacked',
  'scatter-default', 'scatter-rings', 'scatter-solid', 'scatter-outline',
])

export function comparisonPlot(example: ChartExample) {
  if (widePlots.has(example.id)) return 'wide'
  if (example.family === 'tooltip') return example.id === 'tooltip-indicator' || example.id === 'tooltip-motion' ? 'tooltip-controls' : 'wide'
  if (example.family === 'candlestick') return 'candlestick'
  if (example.family === 'radar') return 'radar'
  if (example.family === 'sankey') return 'sankey'
  if (example.family === 'heatmap') return 'heatmap'
  if (example.family === 'live-line') return 'live-line'
  if (example.id === 'treemap-default' || example.id === 'network-default') return 'landscape'
  if (example.id === 'tree-radial') return 'radial-tree'
  if (['pie-default', 'pie-center', 'pie-center-share', 'pie-donut-grow'].includes(example.id)) return 'pie'
  if (example.id === 'ring-default') return 'ring'
  return undefined
}
