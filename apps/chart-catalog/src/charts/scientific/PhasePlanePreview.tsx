import type { ChartPreviewProps } from '../../types'
import { PhasePlane } from './PhasePlane'
import { phasePlaneData, phasePlaneSource } from './phase-plane-data'

const [airOnly, smallBaffle, largeBaffle] = phasePlaneData.runs
const exampleData = { ...phasePlaneData, runs: [largeBaffle, airOnly, smallBaffle] }

export default function PhasePlanePreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use PhasePlane with time-ordered position and velocity samples.</p>
  }
  return <PhasePlane data={exampleData} source={phasePlaneSource} label={example.title} compact={compact} initialTimeSeconds={2} />
}
