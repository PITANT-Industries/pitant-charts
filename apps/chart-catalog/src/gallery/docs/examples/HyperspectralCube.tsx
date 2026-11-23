import { HyperspectralCube, type HyperspectralCubeData } from '../../../index'
import '../../../charts.css'

// Illustrative reflection values stored as hundredths of a percent.
const data: HyperspectralCubeData = {
  width: 4,
  height: 3,
  wavelengthsNm: [470, 550, 650, 850, 1450, 2200],
  values: new Int16Array([
    // Each line is a band, with three rows of four columns.
    1200, 1400, 1800, 1900, 1250, 1500, 1900, 2050, 1400, 1700, 2000, 2150,
    1700, 1900, 2600, 2900, 1800, 2000, 2700, 3050, 1900, 2200, 2950, 3200,
    1900, 2200, 3300, 3650, 2000, 2350, 3450, 3900, 2200, 2500, 3600, 4050,
    4400, 4900, 3650, 3900, 4500, 5100, 3800, 4100, 4750, 5200, 4000, 4200,
    1200, 1400, 1100, 1300, 1250, 1350, 1100, 1300, 1150, 1500, 1400, 1300,
    2900, 3250, 4100, 4450, 3000, 3450, 4350, 4600, 3200, 3600, 4450, -9999,
  ]),
  valueScale: .01,
  noDataValue: -9999,
  excludedBands: [4],
  valueLabel: 'Reflectance',
  valueUnit: '%',
  displayRange: [0, 60],
  initialPixel: [2, 1],
  initialBand: 2,
  rgbBands: [2, 1, 0],
}

export function ExampleHyperspectralCube() {
  return <HyperspectralCube data={data} label="Illustrative reflectance cube" />
}
