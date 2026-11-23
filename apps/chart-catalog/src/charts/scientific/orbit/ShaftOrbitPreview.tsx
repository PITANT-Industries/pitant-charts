import type { ChartPreviewProps } from '../../../types'
import { ShaftOrbit } from './ShaftOrbit'
import { demoShaftOrbits } from './shaft-orbit-data'

const [synchronous, secondOrder, subsynchronous] = demoShaftOrbits.runs
const galleryOrbits = { runs: [secondOrder, synchronous, subsynchronous] }

const source = {
  label: 'Simulated orthogonal displacement probes',
  description: 'Twelve turns at 1,800 rpm, sampled at 5,760 Hz. Each probe signal is centered over the complete simulated record.',
  href: 'https://ntrs.nasa.gov/citations/19860020731',
}

export default function ShaftOrbitPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use ShaftOrbit with aligned displacement samples and trigger indices.</p>
  }
  return <ShaftOrbit data={compact ? galleryOrbits : demoShaftOrbits} source={source} label={example.title} compact={compact} />
}
