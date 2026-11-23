import { AllanDeviation, type AllanDeviationData } from '../../../index'
import '../../../charts.css'

const averagingTimesSeconds = [1, 2, 4, 8, 16, 32, 64, 128]

// Illustrative fractional-frequency stability values from ideal power laws.
const data: AllanDeviationData = {
  quantity: 'Fractional frequency',
  curves: [
    {
      id: 'white-fm',
      label: 'Illustrative white FM',
      points: averagingTimesSeconds.map((tauSeconds) => ({
        tauSeconds,
        deviation: 4e-7 / Math.sqrt(tauSeconds),
      })),
    },
    {
      id: 'random-walk-fm',
      label: 'Illustrative random-walk FM',
      points: averagingTimesSeconds.map((tauSeconds) => ({
        tauSeconds,
        deviation: 3e-8 * Math.sqrt(tauSeconds),
      })),
    },
  ],
}

export function ExampleAllanDeviation() {
  return <AllanDeviation data={data} initialTauSeconds={8} />
}
