import type { ChartPreviewProps } from '../../../types'
import { CoherencePhase } from './CoherencePhase'
import fixture from './coherence-fixture.json'

export default function CoherencePhasePreview({ example, compact, data }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use CoherencePhase with aligned frequencies, coherence estimates, and wrapped phase.</p>
  }
  return <CoherencePhase data={fixture} source={fixture.source} label={example.title} compact={compact}
    initialBand="low" initialFrequencyHz={30} />
}
