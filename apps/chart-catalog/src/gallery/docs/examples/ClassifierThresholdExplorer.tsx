import { ClassifierThresholdExplorer, type ClassifierThresholdData } from '../../../index'
import '../../../charts.css'

const data: ClassifierThresholdData = {
  positiveLabel: 'Fail',
  negativeLabel: 'Pass',
  predictions: [
    { id: 'Sample 01', score: 0.96, actual: true },
    { id: 'Sample 02', score: 0.85, actual: true },
    { id: 'Sample 03', score: 0.72, actual: false },
    { id: 'Sample 04', score: 0.72, actual: true },
    { id: 'Sample 05', score: 0.60, actual: false },
    { id: 'Sample 06', score: 0.56, actual: false },
    { id: 'Sample 07', score: 0.44, actual: true },
    { id: 'Sample 08', score: 0.37, actual: false },
    { id: 'Sample 09', score: 0.31, actual: false },
    { id: 'Sample 10', score: 0.22, actual: false },
    { id: 'Sample 11', score: 0.15, actual: false },
    { id: 'Sample 12', score: 0.08, actual: false },
  ],
}

export function ExampleClassifierThresholdExplorer() {
  return (
    <ClassifierThresholdExplorer
      data={data}
      title="Synthetic inspection scores"
      initialThreshold={0.72}
      caption="Illustrative decision scores and outcomes for 12 samples."
    />
  )
}
