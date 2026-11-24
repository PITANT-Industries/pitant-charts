import type { ChartPreviewProps } from '../../../types'
import { EnergyOperatingMap } from './EnergyOperatingMap'
import { energyOperatingInitialRun, energyOperatingSource, measuredEnergyOperatingMap } from './fixture'

export default function EnergyOperatingMapPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use EnergyOperatingMap with recorded settings, output quantities, and power traces.</p>
  }

  return <EnergyOperatingMap data={measuredEnergyOperatingMap} title={example.title} initialRun={energyOperatingInitialRun}
    compact={compact} caption={<>
      <a href={energyOperatingSource.url}>{energyOperatingSource.title}</a>
      {' · '}
      <a href={energyOperatingSource.licenseUrl}>{energyOperatingSource.license}</a>
      <p>{energyOperatingSource.caption}</p>
    </>} />
}
