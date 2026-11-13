import type { ChartExample } from '../types'
import { detailedLines } from '../charts/cartesian/line-detail-data'

const widePlots = new Set([
  'line-default', 'line-threshold', 'area-default', 'area-forecast', 'area-reference-band',
  'area-reference-range', 'area-trend', 'bar-default', 'bar-stacked',
  'scatter-default', 'scatter-rings', 'scatter-solid', 'scatter-outline',
])

const lineWithControls = new Set([
  'line-table', 'chart-data-table', 'line-synced', 'line-export', 'line-zoom',
  'line-brush', 'line-linked-brush', 'line-date-highlights-brush', 'line-large-data',
])

export function comparisonPlot(example: ChartExample) {
  if (widePlots.has(example.id)) return 'wide'
  if (example.id === 'scatter-jitter' || example.id === 'scatter-large-data') return 'intrinsic'
  if (example.family === 'composed') return 'cartesian-controls'
  if (['hexbin', 'density', 'waterfall', 'lollipop', 'dumbbell', 'histogram', 'ecdf', 'ridgeline', 'beeswarm', 'violin', 'box-plot'].includes(example.family)) return 'cartesian-controls'
  if (example.family === 'line' && (Object.hasOwn(detailedLines, example.id) || lineWithControls.has(example.id))) return 'cartesian-controls'
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
  if ([
    'sparkline', 'sunburst', 'treemap', 'tree', 'network', 'gantt',
    'uncertainty', 'bump', 'slope', 'waffle', 'marimekko', 'stream', 'diverging', 'choropleth',
    'bubble-map', 'route-map', 'globe', 'vector-field',
  ].includes(example.family)) return 'intrinsic'
  if (example.family === 'pie') return 'pie'
  if (example.family === 'ring') return example.id === 'ring-default' ? 'ring-default' : 'ring'
  return undefined
}
