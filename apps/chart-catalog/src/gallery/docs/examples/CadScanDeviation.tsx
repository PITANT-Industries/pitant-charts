import { CadScanDeviation, type CadScanDeviationData } from '../../../index'
import '../../../charts.css'

// Illustrative measurements relative to a plane with its normal pointing along +X.
const data: CadScanDeviationData = {
  nominal: {
    vertices: [[0, -3, -4], [0, 3, -4], [0, 3, 4], [0, -3, 4]],
    triangles: [[0, 1, 2], [0, 2, 3]],
  },
  scan: [
    { point: [.18, -2, -2], closest: [0, -2, -2], deviationMm: .18 },
    { point: [-.12, 0, -2], closest: [0, 0, -2], deviationMm: -.12 },
    { point: [.04, 2, -2], closest: [0, 2, -2], deviationMm: .04 },
    { point: [.22, -2, 0], closest: [0, -2, 0], deviationMm: .22 },
    { point: [-.08, 0, 0], closest: [0, 0, 0], deviationMm: -.08 },
    { point: [.02, 2, 0], closest: [0, 2, 0], deviationMm: .02 },
    { point: [.16, -2, 2], closest: [0, -2, 2], deviationMm: .16 },
    { point: [-.14, 0, 2], closest: [0, 0, 2], deviationMm: -.14 },
    { point: [.06, 2, 2], closest: [0, 2, 2], deviationMm: .06 },
  ],
  sectionAxis: 'z',
  colorLimitMm: .25,
  toleranceMm: .1,
}

export function ExampleCadScanDeviation() {
  return <CadScanDeviation data={data} label="Illustrative signed surface deviations" />
}
