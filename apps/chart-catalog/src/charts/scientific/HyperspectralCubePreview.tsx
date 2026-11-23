import type { ChartPreviewProps } from '../../types'
import { HyperspectralCube } from './HyperspectralCube'
import { hyperspectralData, hyperspectralSource } from './hyperspectral-data'

export default function HyperspectralCubePreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use HyperspectralCube with an image cube and calibrated wavelengths.</p>
  }
  return <HyperspectralCube data={hyperspectralData} source={hyperspectralSource} label={example.title} compact={compact} />
}
