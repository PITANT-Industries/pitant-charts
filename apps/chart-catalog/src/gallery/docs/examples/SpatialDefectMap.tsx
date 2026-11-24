import { SpatialDefectMap, type SpatialDefectData } from '../../../index'
import '../../../charts.css'

// Illustrative die states for a small section of a simulated wafer.
const data: SpatialDefectData = {
  bins: [
    { id: 'parametric-fail', label: 'Parametric fail' },
    { id: 'functional-fail', label: 'Functional fail' },
  ],
  wafers: [
    {
      id: 'example-wafer',
      label: 'Example wafer',
      batch: 'SIM-A',
      geometry: { unit: 'mm', pitchX: 10.4, pitchY: 11.2, originX: -10.4, originY: -11.2, rowDirection: 'up' },
      dies: [
        { row: 0, column: 0, status: 'pass' },
        { row: 0, column: 1, status: 'untested' },
        { row: 0, column: 2, status: 'pass' },
        { row: 1, column: 0, status: 'fail', bin: 'functional-fail' },
        { row: 1, column: 1, status: 'fail', bin: 'parametric-fail' },
        { row: 1, column: 2, status: 'pass' },
        { row: 2, column: 0, status: 'missing' },
        { row: 2, column: 1, status: 'fail', bin: 'parametric-fail' },
        { row: 2, column: 2, status: 'pass' },
      ],
    },
  ],
}

export function ExampleSpatialDefectMap() {
  return <SpatialDefectMap data={data} initialWafer="example-wafer" label="Simulated wafer inspection" />
}
