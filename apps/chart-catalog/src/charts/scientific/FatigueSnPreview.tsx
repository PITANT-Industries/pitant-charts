import type { ChartPreviewProps } from '../../types'
import { FatigueSn } from './FatigueSn'
import { fatigueSnData, fatigueSnSource } from './fatigue-sn-data'

export default function FatigueSnPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use FatigueSn with measured specimen stress, cycles, and test outcomes.</p>
  }
  return <FatigueSn data={fatigueSnData} source={fatigueSnSource} label={example.title} compact={compact} />
}
