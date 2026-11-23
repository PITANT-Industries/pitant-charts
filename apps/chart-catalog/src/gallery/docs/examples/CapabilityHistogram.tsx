import { Distribution } from '@pitant/charts-react'
import '@pitant/charts/styles/tokens.css'

type Props = {
  binStarts: Float64Array
  binEnds: Float64Array
  counts: Float64Array
  specification: { lower: number; target: number; upper: number }
}

export function CapabilityHistogramExample({
  binStarts,
  binEnds,
  counts,
  specification,
}: Props) {
  return (
    <Distribution
      ariaLabel="Calibration factor distribution with specification limits"
      style={{ height: 320 }}
      data={{ binStarts, binEnds, columns: { count: counts } }}
      config={{
        series: [{ key: 'counts', label: 'Observations', field: 'count' }],
        xAxis: { label: 'Calibration factor' },
        yAxis: { label: 'Count', baseline: 0 },
        markers: [
          { key: 'lower', kind: 'lower-spec', value: specification.lower, label: 'Lower spec' },
          { key: 'target', kind: 'target', value: specification.target, label: 'Target' },
          { key: 'upper', kind: 'upper-spec', value: specification.upper, label: 'Upper spec' },
        ],
      }}
    />
  )
}
