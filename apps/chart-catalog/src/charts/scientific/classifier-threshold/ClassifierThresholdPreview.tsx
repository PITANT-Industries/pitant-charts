import type { ChartPreviewProps } from '../../../types'
import { ClassifierThresholdExplorer } from './ClassifierThresholdExplorer'
import { secomClassifierData, secomClassifierSource, secomInitialThreshold } from './fixture'

export default function ClassifierThresholdPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use ClassifierThresholdExplorer with scored observations and known outcomes.</p>
  }

  return <ClassifierThresholdExplorer data={secomClassifierData} title={example.title}
    initialThreshold={secomInitialThreshold} compact={compact} caption={<>
      <a href={secomClassifierSource.url}>{secomClassifierSource.title}</a>
      {' · '}McCann and Johnston (2008){' · '}
      <a href={secomClassifierSource.licenseUrl}>{secomClassifierSource.license}</a>
      <p>{secomClassifierSource.caption}</p>
    </>} />
}
