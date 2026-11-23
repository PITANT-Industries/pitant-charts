import { BinaryPhaseDiagram, type BinaryPhaseDiagramData } from '../../../index'
import '../../../charts.css'

// Illustrative eutectic system. Composition is atomic percent of B.
const data: BinaryPhaseDiagramData = {
  components: ['A', 'B'],
  compositionUnit: 'at. %',
  temperatureDomain: [300, 900],
  eutectic: { temperatureC: 500, leftSolid: 10, liquid: 40, rightSolid: 90 },
  branches: {
    leftLiquidus: [{ composition: 40, temperatureC: 500 }, { composition: 0, temperatureC: 800 }],
    rightLiquidus: [{ composition: 40, temperatureC: 500 }, { composition: 100, temperatureC: 740 }],
    leftSolidus: [{ composition: 10, temperatureC: 500 }, { composition: 0, temperatureC: 800 }],
    rightSolidus: [{ composition: 90, temperatureC: 500 }, { composition: 100, temperatureC: 740 }],
    leftSolvus: [{ composition: 3, temperatureC: 300 }, { composition: 10, temperatureC: 500 }],
    rightSolvus: [{ composition: 97, temperatureC: 300 }, { composition: 90, temperatureC: 500 }],
  },
}

export function ExampleBinaryPhaseDiagram() {
  return (
    <BinaryPhaseDiagram
      data={data}
      initialComposition={20}
      initialTemperatureC={560}
      label="Illustrative binary eutectic phase diagram"
    />
  )
}
