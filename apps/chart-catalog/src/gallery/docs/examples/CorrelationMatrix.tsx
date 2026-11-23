import { CorrelationMatrix, type CorrelationMatrixData } from '@pitant/charts-react'
import '@pitant/charts/styles/tokens.css'

export function CorrelationMatrixExample({ data }: { data: CorrelationMatrixData }) {
  return (
    <CorrelationMatrix
      ariaLabel="Pearson correlation of penguin measurements"
      style={{ height: 320 }}
      data={data}
      config={{
        valueRange: [-1, 1],
        labels: { visible: true },
      }}
    />
  )
}
