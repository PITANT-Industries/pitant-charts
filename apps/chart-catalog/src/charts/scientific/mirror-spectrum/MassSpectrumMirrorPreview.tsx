import type { ChartPreviewProps } from '../../../types'
import { caffeineMassSpectrumMirrorData } from './fixture'
import { MassSpectrumMirror } from './MassSpectrumMirror'

export default function MassSpectrumMirrorPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use MassSpectrumMirror with two centroid peak lists to compare your spectra.</p>
  }
  return <MassSpectrumMirror data={caffeineMassSpectrumMirrorData} label={example.title} compact={compact} />
}
