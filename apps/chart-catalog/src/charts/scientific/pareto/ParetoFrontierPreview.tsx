import type { ChartPreviewProps } from '../../../types'
import { machiningParetoData, machiningParetoSource, oilParetoData, oilParetoSource } from './fixture'
import { ParetoFrontier } from './ParetoFrontier'

export default function ParetoFrontierPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use ParetoFrontier with three objectives and your own measured trial table.</p>
  }
  const turning = example.id === 'pareto-frontier-turning'
  return <ParetoFrontier
    data={turning ? machiningParetoData : oilParetoData}
    source={turning ? machiningParetoSource : oilParetoSource}
    initialTrial={turning ? 'run-17' : 'rpm-16-5'}
    label={example.title}
    compact={compact}
  />
}
