// From Bklit UI (https://bklit.com/r/sunburst-chart.json). See licenses/Bklit-UI-MIT.txt.

export interface SunburstNode {
  name: string
  value?: number
  color?: string
  /** Optional fill override for patterns/gradients (e.g., "url(#patternId)") */
  fill?: string
  children?: readonly SunburstNode[]
}
