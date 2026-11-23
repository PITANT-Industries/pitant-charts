import { CoherencePhase, type CoherenceData } from '../../../index'
import '../../../charts.css'

const data: CoherenceData = {
  runs: [
    {
      id: 'delay-example',
      label: 'Illustrative 8 ms delay',
      frequencyHz: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
      // Illustrative coherence estimates and Y-relative-to-X phase wrapped to ±180°.
      coherence: [0.15, 0.38, 0.84, 0.93, 0.89, 0.88, 0.87, 0.53, 0.92, 0.50],
      phaseDeg: [-28.8, -57.6, -86.4, -115.2, -144, -172.8, 158.4, 129.6, 100.8, 72],
    },
  ],
}

export function ExampleCoherencePhase() {
  return <CoherencePhase data={data} initialFrequencyHz={60} label="Illustrative coherence and phase of delayed vibration" />
}
