import type { ChartPreviewProps } from '../../../types'
import { CampbellDiagram } from './CampbellDiagram'
import ottawa from './ottawa-campbell.json'

export default function CampbellPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use CampbellDiagram with typed frequency, speed, and amplitude arrays.</p>
  }
  return <CampbellDiagram data={ottawa} source={ottawa.source} label={example.title} compact={compact} />
}
