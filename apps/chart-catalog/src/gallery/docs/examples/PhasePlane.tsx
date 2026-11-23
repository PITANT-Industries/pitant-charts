import { PhasePlane, type PhasePlaneData } from '../../../index'
import '../../../charts.css'

const decayRate = 0.24
const dampedRate = 4
const naturalRateSquared = dampedRate ** 2 + decayRate ** 2
const samples = Array.from({ length: 161 }, (_, index) => {
  const timeSeconds = index * 0.05
  const phase = dampedRate * timeSeconds
  const amplitude = 0.55 * Math.exp(-decayRate * timeSeconds)
  return {
    timeSeconds,
    position: amplitude * (Math.cos(phase) + decayRate / dampedRate * Math.sin(phase)),
    velocity: -amplitude * naturalRateSquared / dampedRate * Math.sin(phase),
  }
})

// Analytic response of a linear damped oscillator released from rest.
const data: PhasePlaneData = {
  positionLabel: 'Angular position',
  positionUnit: 'rad',
  velocityLabel: 'Angular velocity',
  velocityUnit: 'rad/s',
  runs: [
    {
      id: 'linear-oscillator',
      label: 'Illustrative linear oscillator',
      samples,
      acceleration: (position, velocity) => -naturalRateSquared * position - 2 * decayRate * velocity,
    },
  ],
}

export function ExamplePhasePlane() {
  return <PhasePlane data={data} initialTimeSeconds={1.25} label="Illustrative damped oscillator" />
}
