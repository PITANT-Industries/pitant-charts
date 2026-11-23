import { StressStrainComparison, type StressStrainData } from '../../../index'
import '../../../charts.css'

const modulusMpa = 69_000
const strains = Array.from({ length: 241 }, (_, index) => index * 0.0005)
const conditions = [
  { id: 'lower-yield', label: 'Illustrative lower yield', yieldMpa: 130, hardeningMpa: 650, peakStrain: 0.10 },
  { id: 'higher-yield', label: 'Illustrative higher yield', yieldMpa: 220, hardeningMpa: 750, peakStrain: 0.08 },
]

// Illustrative elastic, hardening, and post-peak segments.
const data: StressStrainData = {
  curves: conditions.map(({ id, label, yieldMpa, hardeningMpa, peakStrain }) => {
    const yieldStrain = yieldMpa / modulusMpa
    const points = strains.map((strain) => {
      const hardeningStrain = Math.max(0, Math.min(strain, peakStrain) - yieldStrain)
      const postPeakStrain = Math.max(0, strain - peakStrain)
      const stressMpa = Math.min(strain * modulusMpa, yieldMpa) + hardeningMpa * hardeningStrain - 630 * postPeakStrain
      return { strain, stressMpa }
    })
    return {
      id,
      label,
      points,
      elasticFit: { startStrain: 0.0005, endStrain: 0.0015, modulusMpa, interceptMpa: 0 },
    }
  }),
}

export function ExampleStressStrainComparison() {
  return <StressStrainComparison data={data} label="Illustrative tensile curves for two conditions" />
}
