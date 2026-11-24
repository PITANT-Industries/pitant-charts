import type { ChartPreviewProps } from '../../../types'
import { KaplanMeierReliability } from './KaplanMeierReliability'
import { measuredReliability, measuredReliabilityInitialCohort, measuredReliabilityInitialTime, measuredReliabilitySource } from './fixture'

export default function KaplanMeierPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use KaplanMeierReliability with specimen-level failure and censor times.</p>
  }
  return <KaplanMeierReliability data={measuredReliability} initialCohort={measuredReliabilityInitialCohort}
    initialTime={measuredReliabilityInitialTime} source={measuredReliabilitySource} label={example.title} compact={compact} />
}
