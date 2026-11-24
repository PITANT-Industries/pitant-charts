import type { ChartPreviewProps } from '../../../types'
import { LcMsFeatureMap } from './LcMsFeatureMap'
import { measuredLcMsData, measuredLcMsInitialFeature, measuredLcMsSource } from './fixture'

export default function LcMsFeatureMapPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use LcMsFeatureMap with detected features and their original scan evidence.</p>
  }
  return <LcMsFeatureMap data={measuredLcMsData} source={measuredLcMsSource}
    initialFeature={measuredLcMsInitialFeature} label={example.title} compact={compact} />
}
