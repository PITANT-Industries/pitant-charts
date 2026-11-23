import type { ChartPreviewProps } from '../../../types'
import { ModeShapes } from './ModeShapes'
import { demoCantilever } from './cantilever'

export default function ModeShapesPreview({ example, compact, data }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use ModeShapes with beam dimensions and material properties.</p>
  }
  return <ModeShapes beam={demoCantilever} label={example.title} compact={compact} />
}
