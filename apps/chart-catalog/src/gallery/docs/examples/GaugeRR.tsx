import { GaugeRR, type GaugeRRData } from '../../../index'
import '../../../charts.css'

// Simulated dimensional measurements in millimeters.
const data: GaugeRRData = {
  unit: 'mm',
  readings: [
    { part: 'P1', operator: 'A', trial: '1', value: 9.96 },
    { part: 'P1', operator: 'A', trial: '2', value: 9.98 },
    { part: 'P1', operator: 'B', trial: '1', value: 10.02 },
    { part: 'P1', operator: 'B', trial: '2', value: 10.04 },
    { part: 'P2', operator: 'A', trial: '1', value: 10.21 },
    { part: 'P2', operator: 'A', trial: '2', value: 10.23 },
    { part: 'P2', operator: 'B', trial: '1', value: 10.23 },
    { part: 'P2', operator: 'B', trial: '2', value: 10.25 },
  ],
}

export function ExampleGaugeRR() {
  return <GaugeRR data={data} initialCell={{ part: 'P1', operator: 'A' }} label="Simulated dimensional measurement study" />
}
