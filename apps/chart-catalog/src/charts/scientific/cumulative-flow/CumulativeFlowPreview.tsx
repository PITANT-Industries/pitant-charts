import type { ChartPreviewProps } from '../../../types'
import { CumulativeFlow } from './CumulativeFlow'
import { cumulativeFlowInitialStage, cumulativeFlowInitialTime, cumulativeFlowSource, measuredCumulativeFlow } from './fixture'

export default function CumulativeFlowPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use CumulativeFlow with job transitions and explicit completion records.</p>
  }

  return <CumulativeFlow data={measuredCumulativeFlow} title={example.title} initialTime={cumulativeFlowInitialTime}
    initialStage={cumulativeFlowInitialStage} compact={compact} caption={<>
      <a href={cumulativeFlowSource.url}>{cumulativeFlowSource.title}</a>
      {' · '}Malburg, Grüger, and Bergmann{' · '}
      <a href={cumulativeFlowSource.licenseUrl}>{cumulativeFlowSource.license}</a>
      <p>{cumulativeFlowSource.caption}</p>
    </>} />
}
