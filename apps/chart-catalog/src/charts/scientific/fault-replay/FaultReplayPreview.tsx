import type { ChartPreviewProps } from '../../../types'
import { FaultReplay } from './FaultReplay'
import { prontoFaultReplay, prontoReplayInitialTime, prontoReplaySource } from './fixture'

export default function FaultReplayPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use FaultReplay with signals and event records on a common clock.</p>
  }

  return <FaultReplay data={prontoFaultReplay} title={example.title} initialTime={prontoReplayInitialTime} compact={compact}
    caption={<>
      <a href={prontoReplaySource.url}>{prontoReplaySource.title}</a>
      {' · '}Stief, Tan, Cao, and Ottewill (2019){' · '}
      <a href={prontoReplaySource.licenseUrl}>{prontoReplaySource.license}</a>
      <p>{prontoReplaySource.caption}</p>
    </>} />
}
