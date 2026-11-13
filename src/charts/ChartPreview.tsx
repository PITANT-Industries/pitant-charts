import { Component, lazy, Suspense } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { ChartPreviewProps } from '../types'

const Cartesian = lazy(() => import('./cartesian'))
const PolarFlow = lazy(() => import('./polarflow'))
const StatsMaps = lazy(() => import('./statsmaps'))

export const rendererFamilies = {
  cartesian: ['line', 'area', 'live-line', 'sparkline', 'candlestick', 'stream', 'bar', 'diverging', 'composed', 'lollipop', 'dumbbell', 'bump', 'slope', 'waterfall', 'gantt'],
  polarflow: ['pie', 'ring', 'radial', 'gauge', 'waffle', 'marimekko', 'funnel', 'sankey', 'sunburst', 'treemap', 'tree', 'network', 'radar', 'tooltip'],
  statsmaps: ['scatter', 'heatmap', 'uncertainty', 'histogram', 'ridgeline', 'ecdf', 'beeswarm', 'violin', 'box-plot', 'hexbin', 'density', 'choropleth', 'bubble-map', 'route-map', 'globe', 'vector-field'],
} as const

const renderers = new Map<string, ComponentType<ChartPreviewProps>>([
  ...rendererFamilies.cartesian.map((id) => [id, Cartesian] as const),
  ...rendererFamilies.polarflow.map((id) => [id, PolarFlow] as const),
  ...rendererFamilies.statsmaps.map((id) => [id, StatsMaps] as const),
])

class ChartBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <div className="chart-render-message" role="alert">This chart could not render.</div> : this.props.children
  }
}

export function ChartPreview(props: ChartPreviewProps) {
  const Renderer = renderers.get(props.example.family)
  if (!Renderer) return <div className="chart-render-message" role="alert">Chart family unavailable.</div>
  return (
    <div className={`chart-preview${props.compact ? ' chart-preview--compact' : ''}`}>
      <ChartBoundary key={props.example.id}>
        <Suspense fallback={<div className="chart-skeleton" role="status" aria-label="Loading chart" />}>
          <Renderer {...props} />
        </Suspense>
      </ChartBoundary>
    </div>
  )
}
