import type { ChartPreviewProps } from '../../types'
import { StressStrainComparison } from './StressStrainComparison'
import { stressStrainData, stressStrainSource } from './stress-strain-data'

export default function StressStrainComparisonPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use StressStrainComparison with engineering strain, stress, and elastic fits.</p>
  }
  return <StressStrainComparison data={stressStrainData} source={stressStrainSource} label={example.title} compact={compact} />
}
