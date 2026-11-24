import type { ChartPreviewProps } from '../../../types'
import { ChromatogramPeakIntegration } from './ChromatogramPeakIntegration'
import { measuredChromatogram, measuredChromatogramInitialPeak, measuredChromatogramSource } from './fixture'

export default function ChromatogramPeakIntegrationPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use ChromatogramPeakIntegration with acquisition samples and peak windows.</p>
  }
  return <ChromatogramPeakIntegration data={measuredChromatogram} initialPeak={measuredChromatogramInitialPeak}
    source={measuredChromatogramSource} label={example.title} compact={compact} />
}
