import { TimeSeries, type TimeSeriesSpcTrackConfig } from '@pitant/charts-react'
import '@pitant/charts/styles/tokens.css'

type Props = {
  observationNumbers: Float64Array
  calibrationFactors: Float64Array
  controlLimits: Required<Pick<
    TimeSeriesSpcTrackConfig,
    'centerLine' | 'lowerControlLimit' | 'upperControlLimit'
  >> & Pick<TimeSeriesSpcTrackConfig, 'markers'>
}

export function IndividualsControlChartExample({
  observationNumbers,
  calibrationFactors,
  controlLimits,
}: Props) {
  return (
    <TimeSeries
      ariaLabel="Heat flow meter calibration factors and control limits"
      style={{ height: 320 }}
      data={{
        timestamps: observationNumbers,
        columns: { calibration: calibrationFactors },
      }}
      config={{
        series: [{ key: 'calibration', label: 'Calibration factor', field: 'calibration' }],
        xAxis: { label: 'Observation', formatValue: (value) => value.toFixed(0) },
        yAxis: { label: 'Calibration factor' },
        spcTracks: [{ ...controlLimits, key: 'control-limits', chartKind: 'individual' }],
      }}
    />
  )
}
