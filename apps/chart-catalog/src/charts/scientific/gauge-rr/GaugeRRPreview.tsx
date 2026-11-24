import type { ChartPreviewProps } from '../../../types'
import { GaugeRR } from './GaugeRR'
import { baselineGaugeData, baselineGaugeInitialCell, baselineGaugeSource, correctedGaugeData, correctedGaugeInitialCell, correctedGaugeSource } from './fixture'

export default function GaugeRRPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use GaugeRR with a balanced crossed study of parts, operators, and repeated readings.</p>
  }
  const corrected = example.id === 'gauge-rr-thread-corrected'
  return <GaugeRR data={corrected ? correctedGaugeData : baselineGaugeData}
    source={corrected ? correctedGaugeSource : baselineGaugeSource}
    initialCell={corrected ? correctedGaugeInitialCell : baselineGaugeInitialCell} label={example.title} compact={compact} />
}
