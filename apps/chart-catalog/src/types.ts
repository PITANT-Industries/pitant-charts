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

export interface LiveLineSample {
  /** Unix time in milliseconds. Send samples in nondecreasing timestamp order. */
  timestamp: number
  value: number | null
  label?: string
}

export interface LiveLineStream {
  /** Maximum retained readings. Defaults to 4,096 and is capped at 1,000,000. */
  capacity?: number
  /** Optional chronological readings for the initial window. */
  initialSamples?: readonly LiveLineSample[]
  /** Receives batches in timestamp order and returns a cleanup function. */
  subscribe: (receive: (samples: readonly LiveLineSample[]) => void) => () => void
}

export interface ChartPreviewProps {
  example: ChartExample
  data?: ChartData
  compact?: boolean
  /** Optional live source for Live Line charts. */
  liveStream?: LiveLineStream
  /** Custom center content for donut and ring charts. */
  renderCenter?: (context: ChartCenterContext) => ReactNode
  /** Custom panel content for examples in the Tooltip family. */
  renderTooltip?: (context: ChartTooltipContext) => ReactNode
}
