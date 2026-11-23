import type { ChartPreviewProps } from '../../../types'
import { EyeDiagram } from './EyeDiagram'
import { eyeFixture } from './eye-fixture'

const [reference, impaired] = eyeFixture.runs
const galleryEye = {
  ...eyeFixture,
  runs: [{ ...impaired, label: 'Simulated impaired channel' }, reference],
}
const source = {
  label: 'Simulated 1 Gbaud NRZ signal',
  description: 'A periodic PRBS7 sequence is folded against the ideal clock. Both channels use nominal −400 and +400 mV levels.',
  href: 'https://www.tek.com/en/documents/application-note/anatomy-eye-diagram',
}

export default function EyeDiagramPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use EyeDiagram with aligned voltage traces and their bit labels.</p>
  }
  return <EyeDiagram data={compact ? galleryEye : eyeFixture} source={source} label={example.title} compact={compact} />
}
