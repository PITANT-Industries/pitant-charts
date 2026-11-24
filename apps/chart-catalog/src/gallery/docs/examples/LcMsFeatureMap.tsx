import { LcMsFeatureMap, type LcMsFeatureData } from '../../../index'
import '../../../charts.css'

// Illustrative features and scan intensities for one simulated acquisition.
const data: LcMsFeatureData = {
  features: [
    {
      id: 'feature-1',
      rtSeconds: 76,
      mz: 195.0877,
      intensity: 450,
      charge: 1,
      traces: [
        {
          id: 'feature-1-mono',
          mz: 195.0877,
          hull: [[68, 195.083], [84, 195.083], [84, 195.092], [68, 195.092]],
          mzWindow: [195.082, 195.094],
          samples: [
            ['scan=101', 68, 0],
            ['scan=102', 72, 108],
            ['scan=103', 76, 450],
            ['scan=104', 80, null],
            ['scan=105', 84, 25],
          ],
        },
        {
          id: 'feature-1-isotope-1',
          mz: 196.0911,
          hull: [[72, 196.085], [80, 196.085], [80, 196.097], [72, 196.097]],
          mzWindow: [196.084, 196.098],
          samples: [['scan=102', 72, 21], ['scan=103', 76, 69], ['scan=104', 80, 16]],
        },
      ],
    },
    {
      id: 'feature-2',
      rtSeconds: 94,
      mz: 201.103,
      intensity: 216,
      traces: [
        {
          id: 'feature-2-mass-trace',
          mz: 201.103,
          hull: [[88, 201.097], [100, 201.097], [100, 201.110], [88, 201.110]],
          mzWindow: [201.095, 201.111],
          samples: [['scan=106', 88, 30], ['scan=107', 94, 216], ['scan=108', 100, 13]],
        },
      ],
    },
  ],
}

export function ExampleLcMsFeatureMap() {
  return <LcMsFeatureMap data={data} initialFeature="feature-1" label="Simulated LC–MS feature map" />
}
