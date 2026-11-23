import { Spectrogram, type SpectrogramMatrixData } from '@pitant/charts-react'
import '@pitant/charts/styles/tokens.css'

export function SpectrogramExample({ data }: { data: SpectrogramMatrixData }) {
  return (
    <Spectrogram
      ariaLabel="CO₂ amplitude by year and frequency"
      style={{ height: 320 }}
      data={data}
      config={{
        xAxis: { label: 'Window center (year)' },
        yAxis: { label: 'Frequency (cycles/year)' },
        zAxis: { label: 'Peak amplitude (ppm)' },
      }}
    />
  )
}
