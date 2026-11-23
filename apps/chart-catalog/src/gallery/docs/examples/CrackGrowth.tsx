import { CrackGrowth, type CrackGrowthData } from '../../../index'
import '../../../charts.css'

// Illustrative values. ΔK is in MPa√m and crack growth is in mm/cycle.
const data: CrackGrowthData = {
  series: [
    {
      id: 'illustrative',
      label: 'Illustrative compact-tension specimen',
      stressRatio: 0.1,
      fitRange: [14, 32],
      points: [
        { deltaK: 10, rateMmPerCycle: 3.4e-6 },
        { deltaK: 14, rateMmPerCycle: 1.6e-5 },
        { deltaK: 18, rateMmPerCycle: 3.5e-5 },
        { deltaK: 24, rateMmPerCycle: 7.8e-5 },
        { deltaK: 32, rateMmPerCycle: 1.9e-4 },
        { deltaK: 45, rateMmPerCycle: 6.8e-4 },
      ],
    },
  ],
}

export function ExampleCrackGrowth() {
  return <CrackGrowth data={data} label="Illustrative fatigue crack growth" />
}
