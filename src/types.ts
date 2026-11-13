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

export interface ChartPreviewProps {
  example: ChartExample
  data?: ChartData
  compact?: boolean
}
