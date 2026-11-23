import type { ChartPreviewProps } from '../../types'
import { CieChromaticityDiagram } from './CieChromaticityDiagram'
import { cieChromaticityData, cieChromaticitySource } from './cie-chromaticity-data'

export default function CieChromaticityDiagramPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use CieChromaticityDiagram with spectral chromaticities and color primaries.</p>
  }
  return <CieChromaticityDiagram data={cieChromaticityData} source={cieChromaticitySource} label={example.title} compact={compact} />
}
