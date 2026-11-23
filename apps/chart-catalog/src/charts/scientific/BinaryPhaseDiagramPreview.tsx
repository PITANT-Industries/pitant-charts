import type { ChartPreviewProps } from '../../types'
import { BinaryPhaseDiagram } from './BinaryPhaseDiagram'
import { binaryPhaseData, binaryPhaseSource } from './binary-phase-data'

export default function BinaryPhaseDiagramPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use BinaryPhaseDiagram with modeled eutectic boundaries and their composition basis.</p>
  }
  return <BinaryPhaseDiagram data={binaryPhaseData} source={binaryPhaseSource} label={example.title}
    compact={compact} initialComposition={20} initialTemperatureC={850} />
}
