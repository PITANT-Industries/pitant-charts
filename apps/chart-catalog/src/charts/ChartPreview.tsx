import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import type { ChartPreviewProps } from '../types'
import { ChartThemeContext, fallbackChartTheme, readChartTheme } from './theme'

const Cartesian = lazy(() => import('./cartesian'))
const PolarFlow = lazy(() => import('./polarflow'))
const StatsMaps = lazy(() => import('./statsmaps'))
const DenseLine = lazy(() => import('./cartesian/LineLargeDetail'))
const DenseScatter = lazy(() => import('./statsmaps/dense-scatter/DenseScatter'))

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
  const Renderer = props.example.id === 'line-large-data' ? DenseLine
    : props.example.id === 'scatter-large-data' ? DenseScatter
      : renderers.get(props.example.family)
  const host = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState(fallbackChartTheme)
  useEffect(() => {
    const element = host.current
    if (!element) return
    let frame = 0
    const read = () => {
      const next = readChartTheme(element)
      setTheme((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(read)
    }
    const observer = new MutationObserver(schedule)
    for (let ancestor: HTMLElement | null = element; ancestor; ancestor = ancestor.parentElement) {
      observer.observe(ancestor, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] })
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', schedule)
    window.addEventListener('chart-theme-change', schedule)
    read()
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      media.removeEventListener('change', schedule)
      window.removeEventListener('chart-theme-change', schedule)
    }
  }, [Renderer])
  if (!Renderer) return <div className="chart-render-message" role="alert">Chart family unavailable.</div>
  return (
    <div ref={host} className={`chart-preview${props.compact ? ' chart-preview--compact' : ''}`}>
      <ChartThemeContext.Provider value={theme}>
        <ChartBoundary key={props.example.id}>
          <Suspense fallback={<div className="chart-skeleton" role="status" aria-label="Loading chart" />}>
            <Renderer {...props} />
          </Suspense>
        </ChartBoundary>
      </ChartThemeContext.Provider>
    </div>
  )
}
