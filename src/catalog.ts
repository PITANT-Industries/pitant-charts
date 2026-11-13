import data from './catalog-data.json'
import type { ChartExample, ChartFamily, ChartGroup } from './types'

export const families: readonly ChartFamily[] = data

export const groups: readonly ChartGroup[] = [
  { id: 'trends', name: 'Trends & time series', families: ['line', 'area', 'live-line', 'sparkline', 'candlestick', 'stream'] },
  { id: 'comparisons', name: 'Comparisons & rankings', families: ['bar', 'diverging', 'composed', 'lollipop', 'dumbbell', 'bump', 'slope', 'radar'] },
  { id: 'composition', name: 'Composition & KPIs', families: ['pie', 'ring', 'radial', 'gauge', 'waffle', 'marimekko'] },
  { id: 'processes', name: 'Processes & schedules', families: ['funnel', 'sankey', 'waterfall', 'gantt'] },
  { id: 'hierarchies', name: 'Hierarchies & networks', families: ['sunburst', 'treemap', 'tree', 'network'] },
  { id: 'statistics', name: 'Distributions & statistics', families: ['scatter', 'heatmap', 'uncertainty', 'histogram', 'ridgeline', 'ecdf', 'beeswarm', 'violin', 'box-plot', 'hexbin', 'density'] },
  { id: 'maps', name: 'Maps & spatial data', families: ['choropleth', 'bubble-map', 'route-map', 'globe', 'vector-field'] },
  { id: 'tooltips', name: 'Tooltips', families: ['tooltip'] },
]

const byFamily = new Map(families.map((family) => [family.id, family]))
export const examples: readonly ChartExample[] = families.flatMap((family) => family.examples)
const byId = new Map(examples.map((example) => [example.id, example]))

export function getExample(id: string) {
  return byId.get(id)
}

export function getFamily(id: string) {
  return byFamily.get(id)
}

export function getGroupForFamily(id: string) {
  return groups.find((group) => group.families.includes(id))
}

const preferredFamilies = ['line', 'bar', 'pie', 'area', 'radar', 'heatmap', 'gauge', 'sankey', 'choropleth']
const preferredExamples = ['line-time-range', 'bar-stacked', 'pie-center', 'area-gradient-fill']
const featured = [...new Set([
  ...preferredExamples.map(getExample).filter((item): item is ChartExample => Boolean(item)),
  ...preferredFamilies.map((id) => getFamily(id)?.examples[0]).filter((item): item is ChartExample => Boolean(item)),
  ...families.map((family) => family.examples[0]),
])]
const featuredIds = new Set(featured.map((example) => example.id))

export const galleryOrder = [...featured, ...examples.filter((example) => !featuredIds.has(example.id))]
