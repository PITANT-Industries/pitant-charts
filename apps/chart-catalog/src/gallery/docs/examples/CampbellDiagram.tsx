import { CampbellDiagram, type CampbellDiagramData } from '../../../index'
import '../../../charts.css'

// Illustrative amplitudes in dB relative to one shared reference.
const data: CampbellDiagramData = {
  frequenciesHz: [0, 10, 20, 30, 40, 50, 60],
  runs: [
    {
      id: 'healthy',
      label: 'Healthy bearing',
      rpm: [900, 1200, 1500, 1800],
      levelsDb: [
        [-60, -14, -17, -24, -39, -45, -53],
        [-59, -30, -10, -33, -21, -48, -51],
        [-60, -45, -14, -17, -38, -20, -50],
        [-61, -48, -34, -9, -31, -40, -19],
      ],
    },
    {
      id: 'fault',
      label: 'Bearing with a fault',
      rpm: [900, 1200, 1500, 1800],
      levelsDb: [
        [-57, -18, -19, -22, -32, -9, -35],
        [-58, -29, -13, -33, -18, -5, -32],
        [-57, -42, -17, -15, -29, 0, -31],
        [-59, -43, -31, -12, -24, -4, -17],
      ],
    },
  ],
}

export function BearingRunUp() {
  return <CampbellDiagram data={data} label="Illustrative bearing run-up" />
}
