import type { ChartExample } from '../types'
import { detailedLines } from '../charts/cartesian/line-detail-data'

const widePlots = new Set([
  'line-default', 'line-threshold', 'area-default', 'area-forecast', 'area-reference-band',
  'area-reference-range', 'area-trend', 'bar-default', 'bar-stacked',
  'scatter-default', 'scatter-rings', 'scatter-solid', 'scatter-outline',
])

export function comparisonPlot(example: ChartExample) {
  if (widePlots.has(example.id)) return 'wide'
  if (example.family === 'composed') return 'cartesian-controls'
  if (example.family === 'line' && Object.hasOwn(detailedLines, example.id)) return 'cartesian-controls'
  if (example.family === 'bar') return 'cartesian-controls'
  if (example.family === 'area') return ['area-small-multiples', 'area-loading'].includes(example.id) ? 'cartesian-controls' : 'wide'
  if (example.family === 'tooltip') return example.id === 'tooltip-indicator' || example.id === 'tooltip-motion' ? 'tooltip-controls' : 'wide'
  if (example.family === 'candlestick') return 'candlestick'
  if (example.family === 'radar') return 'radar'
  if (example.family === 'sankey') return 'sankey'
  if (example.family === 'heatmap') return 'heatmap'
  if (example.family === 'live-line') return 'live-line'
  if (example.family === 'radial') return 'radial'
  if (example.family === 'gauge') return 'gauge'
  if (example.family === 'funnel') return 'funnel'
  if (example.id === 'treemap-default' || example.id === 'network-default') return 'landscape'
  if (example.id === 'tree-radial') return 'radial-tree'
  if (example.family === 'pie') return 'pie'
  if (example.family === 'ring') return example.id === 'ring-default' ? 'ring-default' : 'ring'
  return undefined
}
