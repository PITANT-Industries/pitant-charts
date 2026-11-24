import type { ChartPreviewProps } from '../../../types'
import { TaktBalance } from './TaktBalance'
import { measuredTaktBalance, taktBalanceInitialTask, taktBalanceSource } from './fixture'

export default function TaktBalancePreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use TaktBalance with workload, demand, and ordered workstation data.</p>
  }

  return <TaktBalance data={measuredTaktBalance} title={example.title} initialTask={taktBalanceInitialTask}
    compact={compact} caption={<>
      <a href={taktBalanceSource.url}>{taktBalanceSource.title}</a>
      {' · '}
      <a href={taktBalanceSource.licenseUrl}>{taktBalanceSource.license}</a>
      <p>{taktBalanceSource.caption}</p>
    </>} />
}
