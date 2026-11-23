import { CorrelationMatrix, type CorrelationMatrixData } from '@pitant/charts-react'
import '@pitant/charts/styles/tokens.css'

// Pearson r computed across 1,941 Steel Plates Faults records.
// Buscema, Terzi, and Tastle (2010), UCI Machine Learning Repository.
// https://doi.org/10.24432/C5J88N · https://creativecommons.org/licenses/by/4.0/
const steelDefectData: CorrelationMatrixData = {
  variables: [
    { key: 'Pixels_Areas', label: 'Defect area' },
    { key: 'X_Perimeter', label: 'X perimeter' },
    { key: 'Y_Perimeter', label: 'Y perimeter' },
    { key: 'Steel_Plate_Thickness', label: 'Thickness' },
  ],
  values: new Float64Array([
    1,                   0.9666440704235102,  0.8271992124249629,  -0.18373508633467248,
    0.9666440704235102,  1,                   0.9124364588883528,  -0.14771168657693132,
    0.8271992124249629,  0.9124364588883528,  1,                   -0.058888802915430354,
    -0.18373508633467248, -0.14771168657693132, -0.058888802915430354, 1,
  ]),
  valueLayout: 'row-major',
  sampleCounts: new Uint16Array(16).fill(1941),
}

export function SteelDefectCorrelation({ data = steelDefectData }: { data?: CorrelationMatrixData } = {}) {
  return (
    <CorrelationMatrix
      ariaLabel="Pearson correlations of steel surface defect measurements"
      style={{ height: 320 }}
      data={data}
      config={{
        valueRange: [-1, 1],
        labels: { visible: true },
      }}
    />
  )
}
