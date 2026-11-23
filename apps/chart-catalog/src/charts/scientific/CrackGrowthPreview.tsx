import type { ChartPreviewProps } from '../../types'
import { CrackGrowth } from './CrackGrowth'
import { crackGrowthData, crackGrowthSource } from './crack-growth-data'

export default function CrackGrowthPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use CrackGrowth with measured stress-intensity ranges and crack-growth rates.</p>
  }
  return <CrackGrowth data={crackGrowthData} source={crackGrowthSource} label={example.title} compact={compact} />
}
