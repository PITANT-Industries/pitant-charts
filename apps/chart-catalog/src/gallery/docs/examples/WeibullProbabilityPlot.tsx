import { WeibullProbabilityPlot, type ReliabilityData } from '../../../index'
import '../../../charts.css'

// Illustrative supplier-component tests. A censor records time on test.
const data: ReliabilityData = {
  timeUnit: 'h',
  cohorts: [
    {
      id: 'a',
      label: 'Supplier A',
      observations: [
        { id: 'A1', time: 90, status: 'failed' },
        { id: 'A2', time: 130, status: 'failed' },
        { id: 'A3', time: 130, status: 'failed' },
        { id: 'A4', time: 130, status: 'censored' },
        { id: 'A5', time: 230, status: 'censored' },
      ],
    },
    {
      id: 'b',
      label: 'Supplier B',
      observations: [
        { id: 'B1', time: 110, status: 'failed' },
        { id: 'B2', time: 160, status: 'failed' },
        { id: 'B3', time: 185, status: 'failed' },
        { id: 'B4', time: 240, status: 'censored' },
        { id: 'B5', time: 260, status: 'censored' },
      ],
    },
  ],
}

export function ExampleWeibullProbabilityPlot() {
  return <WeibullProbabilityPlot data={data} initialCohort="a" label="Illustrative supplier component life test" />
}
