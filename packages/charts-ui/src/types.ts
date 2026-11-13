export interface ChartCenterContext {
  name: string | null
  value: number
  total: number
  /** Fraction of the total, between 0 and 1. */
  share: number
}
