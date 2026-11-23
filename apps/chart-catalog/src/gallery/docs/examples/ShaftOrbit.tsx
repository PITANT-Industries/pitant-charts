import { ShaftOrbit, type ShaftOrbitData } from '../../../index'
import '../../../charts.css'

const shaftRpm = 1800
const sampleRateHz = 3600
const revolutions = 3
const samplesPerTurn = (60 * sampleRateHz) / shaftRpm
const angles = Array.from(
  { length: revolutions * samplesPerTurn + 1 },
  (_, index) => (2 * Math.PI * index) / samplesPerTurn,
)

const data: ShaftOrbitData = {
  runs: [
    {
      id: 'ellipse',
      label: 'Simulated 1× ellipse',
      sampleRateHz,
      xUm: angles.map((angle) => 40 * Math.cos(angle)),
      yUm: angles.map((angle) => 24 * Math.sin(angle)),
      triggerSamples: Array.from({ length: revolutions + 1 }, (_, index) => index * samplesPerTurn),
    },
  ],
}

export function SimulatedShaftOrbit() {
  return <ShaftOrbit data={data} label="Simulated orthogonal shaft displacement" />
}
