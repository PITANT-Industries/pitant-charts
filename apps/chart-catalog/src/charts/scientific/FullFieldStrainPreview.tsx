import type { ChartPreviewProps } from '../../types'
import { FullFieldStrain } from './FullFieldStrain'
import { fullFieldStrainData, fullFieldStrainSource } from './full-field-strain-data'

export default function FullFieldStrainPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use FullFieldStrain with calibrated coordinates, strain fields, and corresponding force readings.</p>
  }
  return <FullFieldStrain data={fullFieldStrainData} source={fullFieldStrainSource} label={example.title} compact={compact} initialStage={60} />
}
