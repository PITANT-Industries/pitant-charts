import type { ChartPreviewProps } from '../../../types'
import { measuredWaferData, measuredWaferSource, simulatedWaferData, simulatedWaferSource } from './fixture'
import { SpatialDefectMap } from './SpatialDefectMap'

export default function SpatialDefectMapPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use SpatialDefectMap with a wafer table and recorded die results.</p>
  }
  const simulated = example.id === 'spatial-defect-map-simulated'
  return <SpatialDefectMap data={simulated ? simulatedWaferData : measuredWaferData}
    source={simulated ? simulatedWaferSource : measuredWaferSource} label={example.title}
    initialWafer={simulated ? 'sim-a-01' : 'lot2-wafer20'} compact={compact} />
}
