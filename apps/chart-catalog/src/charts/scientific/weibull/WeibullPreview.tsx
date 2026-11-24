import type { ChartPreviewProps } from '../../../types'
import { WeibullProbabilityPlot } from './WeibullProbabilityPlot'
import {
  measuredWeibull, measuredWeibullInitialCohort, measuredWeibullSource,
  simulatedWeibull, simulatedWeibullInitialCohort, simulatedWeibullSource,
} from './fixture'

export default function WeibullPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use WeibullProbabilityPlot with specimen-level failure and right-censor times.</p>
  }
  const simulated = example.id === 'weibull-probability-suppliers'
  return <WeibullProbabilityPlot data={simulated ? simulatedWeibull : measuredWeibull}
    initialCohort={simulated ? simulatedWeibullInitialCohort : measuredWeibullInitialCohort}
    source={simulated ? simulatedWeibullSource : measuredWeibullSource} label={example.title} compact={compact} />
}
