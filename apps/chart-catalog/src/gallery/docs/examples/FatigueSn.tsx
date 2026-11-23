import { FatigueSn, type FatigueSnData } from '../../../index'
import '../../../charts.css'

// Illustrative specimen outcomes, with run-outs censored at the prescribed cutoff.
const data: FatigueSnData = {
  stressLabel: 'Stress amplitude',
  series: [
    {
      id: 'illustrative',
      label: 'Illustrative fully reversed loading',
      stressRatio: -1,
      tests: [
        { id: 'S1', stressMpa: 260, cycles: 74_000, outcome: 'failure' },
        { id: 'S2', stressMpa: 240, cycles: 182_000, outcome: 'failure' },
        { id: 'S3', stressMpa: 220, cycles: 410_000, outcome: 'failure' },
        { id: 'S4', stressMpa: 210, cycles: 925_000, outcome: 'failure' },
        { id: 'S5', stressMpa: 210, cycles: 2_000_000, outcome: 'runout' },
        { id: 'S6', stressMpa: 195, cycles: 2_000_000, outcome: 'runout' },
      ],
    },
  ],
}

export function ExampleFatigueSn() {
  return <FatigueSn data={data} label="Illustrative fatigue failures and run-outs" />
}
