import { Spectrum } from '@pitant/charts-react'
import '@pitant/charts/styles/tokens.css'

type Props = {
  frequencies: Float64Array
  amplitudes: Float64Array
}

export function SpectrumExample({ frequencies, amplitudes }: Props) {
  return (
    <Spectrum
      ariaLabel="CO₂ amplitude spectrum"
      style={{ height: 320 }}
      data={{ frequencies, columns: { amplitude: amplitudes } }}
      config={{
        series: [{ key: 'co2', label: 'CO₂ amplitude', field: 'amplitude' }],
        xAxis: { label: 'Frequency (cycles/year)' },
        yAxis: { label: 'Peak amplitude (ppm)', baseline: 0 },
      }}
    />
  )
}
