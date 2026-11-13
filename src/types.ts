import type { ReactNode } from 'react'

export interface ChartExample {
  id: string
  family: string
  title: string
  label: string
  description: string
  url: string
  position: number
}

export interface ChartFamily {
  id: string
  name: string
  url: string
  examples: readonly ChartExample[]
}

export interface ChartGroup {
  id: string
  name: string
  families: readonly string[]
}

export interface ChartSeries {
  name: string
  values: readonly (number | null)[]
  color?: string
}

export interface ChartData {
  categories?: readonly string[]
  series?: readonly ChartSeries[]
  rows?: readonly Record<string, unknown>[]
}

export interface ChartCenterContext {
  name: string | null
  value: number
  total: number
  /** Value divided by the relevant total or progress target. */
  share: number
  target?: number
}

export interface ChartTooltipContext {
  category: string
  index: number
  pinned: boolean
  series: readonly {
    name: string
    value: number | null
    previousValue: number | null
    color: string
  }[]
}

export interface ChartPreviewProps {
  example: ChartExample
  data?: ChartData
  compact?: boolean
  /** Custom center content for donut and ring charts. */
  renderCenter?: (context: ChartCenterContext) => ReactNode
  /** Custom panel content for examples in the Tooltip family. */
  renderTooltip?: (context: ChartTooltipContext) => ReactNode
}
