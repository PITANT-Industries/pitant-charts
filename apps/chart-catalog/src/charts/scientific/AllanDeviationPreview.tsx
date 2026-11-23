import type { ChartPreviewProps } from '../../types'
import { AllanDeviation } from './AllanDeviation'
import { allanDeviationData, allanDeviationSource } from './allan-deviation-data'

export default function AllanDeviationPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use AllanDeviation with positive averaging times and corresponding measured deviations.</p>
  }
  return <AllanDeviation data={allanDeviationData} source={allanDeviationSource} label={example.title} compact={compact} initialTauSeconds={100} />
}
