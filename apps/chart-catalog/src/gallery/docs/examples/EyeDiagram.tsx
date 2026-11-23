import { EyeDiagram, type EyeDiagramData } from '../../../index'
import '../../../charts.css'

const timeUi = [-0.5, -0.25, -0.125, 0, 0.125, 0.25, 0.5, 0.75, 1, 1.25, 1.5]
const hold = (voltage: number) => timeUi.map(() => voltage)

// Illustrative folded transitions with small crossing offsets and 2% rail excursions.
const data: EyeDiagramData = {
  timeUi,
  symbolRateBaud: 1e9,
  runs: [
    {
      id: 'nrz-example',
      label: 'Illustrative folded NRZ traces',
      levelsMv: [-400, 400],
      traces: [
        { previousBit: 0, bit: 0, voltageMv: hold(-400) },
        { previousBit: 0, bit: 1, voltageMv: [-400, -400, -400, -60, 416, 400, 400, 400, 400, 400, 400] },
        { previousBit: 1, bit: 0, voltageMv: [400, 400, 400, -60, -416, -400, -400, -400, -400, -400, -400] },
        { previousBit: 1, bit: 1, voltageMv: hold(400) },
      ],
    },
  ],
}

export function ExampleEyeDiagram() {
  return <EyeDiagram data={data} label="Illustrative 1 Gbaud NRZ signal" />
}
