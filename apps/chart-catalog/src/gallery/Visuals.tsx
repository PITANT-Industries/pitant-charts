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

export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><BarChart3 size={19} strokeWidth={2.2} /></span>
}

export function HeroChart() {
  const bars = [24, 39, 33, 56, 49, 77, 64, 92, 82, 115, 101, 138, 119, 153, 132, 163, 145]
  return (
    <div className="hero-visual" aria-hidden="true">
      <svg viewBox="0 0 560 238" preserveAspectRatio="xMidYMid slice" fill="none">
        <defs>
          <pattern id="hero-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0v32" fill="none" stroke="currentColor" strokeWidth="1" />
          </pattern>
          <linearGradient id="hero-stroke" x1="18" y1="170" x2="547" y2="47" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--gallery-hero-accent, var(--chart-1))" />
            <stop offset=".68" stopColor="var(--gallery-hero-mid, var(--chart-2))" />
            <stop offset="1" stopColor="var(--gallery-hero-strong, var(--chart-3))" />
          </linearGradient>
          <linearGradient id="hero-fill" x1="0" y1="44" x2="0" y2="223" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--chart-2)" stopOpacity=".25" />
            <stop offset="1" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="hero-bars" x1="0" y1="62" x2="0" y2="223" gradientUnits="userSpaceOnUse">
            <stop stopColor="var(--gallery-hero-accent, var(--chart-1))" stopOpacity=".42" />
            <stop offset="1" stopColor="var(--chart-1)" stopOpacity=".1" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="560" height="238" className="hero-grid" fill="url(#hero-grid)" />
        {bars.map((height, index) => <rect key={index} x={20 + index * 31} y={222 - height} width="15" height={height} rx="3" fill="url(#hero-bars)" />)}
        <path d="M0 191C27 191 33 172 59 172S95 184 117 170s32-39 56-39 36 13 54 5 39-44 62-44 39 20 60 12 40-47 65-47 35 14 52 8 40-38 63-38h31v196H0Z" fill="url(#hero-fill)" />
        <path d="M0 191C27 191 33 172 59 172S95 184 117 170s32-39 56-39 36 13 54 5 39-44 62-44 39 20 60 12 40-47 65-47 35 14 52 8 40-38 63-38h31" stroke="url(#hero-stroke)" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M414 57v165" stroke="var(--gallery-hero-mid, var(--chart-2))" strokeOpacity=".55" strokeDasharray="4 5" />
        <circle cx="414" cy="57" r="13" fill="var(--gallery-hero-accent, var(--chart-1))" opacity=".32" />
        <circle cx="414" cy="57" r="5" fill="var(--gallery-hero-mid, var(--chart-2))" stroke="var(--gallery-hero-marker, var(--card))" strokeWidth="2" />
        <path d="M0 223h560" stroke="var(--gallery-hero-accent, var(--chart-1))" strokeOpacity=".4" />
      </svg>
    </div>
  )
}

export const familyIcons = { line: LineChart, bar: BarChart3, pie: PieChart, tree: GitFork, treemap: Box, 'choropleth': Map } as const
export const defaultFamilyIcon = Blocks
