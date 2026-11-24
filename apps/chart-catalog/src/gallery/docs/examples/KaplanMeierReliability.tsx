import { KaplanMeierReliability, type ReliabilityData } from '../../../index'
import '../../../charts.css'

// Illustrative time-to-failure and right-censored test records in hours.
const data: ReliabilityData = {
  timeUnit: 'h',
  cohorts: [
    {
      id: 'a',
      label: 'Cohort A',
      observations: [
        { id: 'A1', time: 120, status: 'failed' },
        { id: 'A2', time: 120, status: 'censored' },
        { id: 'A3', time: 180, status: 'failed' },
        { id: 'A4', time: 240, status: 'censored' },
      ],
    },
    {
      id: 'b',
      label: 'Cohort B',
      observations: [
        { id: 'B1', time: 150, status: 'failed' },
        { id: 'B2', time: 210, status: 'failed' },
        { id: 'B3', time: 210, status: 'failed' },
        { id: 'B4', time: 240, status: 'censored' },
      ],
    },
  ],
}

export function ExampleKaplanMeierReliability() {
  return <KaplanMeierReliability data={data} initialCohort="a" initialTime={120} label="Illustrative component reliability test" />
}
