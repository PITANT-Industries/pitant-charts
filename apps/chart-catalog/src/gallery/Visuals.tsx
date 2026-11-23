import {
  Activity, BarChart3, Blocks, Box, ChartNoAxesCombined, GitFork, Globe2,
  Grid2X2, LineChart, Map, MousePointer2, Network, PieChart, Workflow,
} from 'lucide-react'

export const groupIcons = {
  all: Grid2X2,
  trends: ChartNoAxesCombined,
  comparisons: BarChart3,
  composition: PieChart,
  processes: Workflow,
  hierarchies: Network,
  statistics: Activity,
  maps: Globe2,
  tooltips: MousePointer2,
} as const

export const familyIcons = { line: LineChart, bar: BarChart3, pie: PieChart, tree: GitFork, treemap: Box, 'choropleth': Map } as const
export const defaultFamilyIcon = Blocks
