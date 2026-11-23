import { FullFieldStrain, type FullFieldStrainData } from '../../../index'
import '../../../charts.css'

const xMm = [-4, -2, 0, 2, 4]
const yMm = [-8, -4, 0, 4, 8]
const stages = [
  { stage: 0.25, forceN: 100, peakStrain: 0.35 },
  { stage: 1.2, forceN: 500, peakStrain: 1.2 },
  { stage: 2.4, forceN: 420, peakStrain: 3.6 },
]

// Illustrative strain localization on a coupon with a masked central notch.
const data: FullFieldStrainData = {
  xMm,
  yMm,
  componentLabel: 'Longitudinal strain',
  stageLabel: 'Extension',
  stageUnit: 'mm',
  strainDomainPercent: [0, 4],
  frames: stages.map(({ stage, forceN, peakStrain }) => ({
    stage,
    forceN,
    strainPercent: yMm.flatMap((y) => xMm.map((x) => {
      if (y === 0 && Math.abs(x) === 4) return null
      const localization = Math.exp(-(x ** 2 / 5 + y ** 2 / 15))
      return peakStrain * (0.22 + 0.78 * localization)
    })),
  })),
}

export function ExampleFullFieldStrain() {
  return <FullFieldStrain data={data} initialStage={1.2} label="Illustrative strain localization on a notched coupon" />
}
