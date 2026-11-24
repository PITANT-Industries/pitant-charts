import type { ChartPreviewProps } from '../../../types'
import { StartupOverlay } from './StartupOverlay'
import { measuredStartupOverlay, startupOverlayInitialRun, startupOverlaySource } from './fixture'

export default function StartupOverlayPreview({ example, data, compact }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Use StartupOverlay with timestamped runs and recorded startup events.</p>
  }

  return <StartupOverlay data={measuredStartupOverlay} initialRun={startupOverlayInitialRun} title={example.title} compact={compact}
    caption={<>
      <a href={startupOverlaySource.url}>{startupOverlaySource.title}</a>
      {' · '}Arweiler and colleagues (2026){' · '}
      <a href={startupOverlaySource.licenseUrl}>{startupOverlaySource.license}</a>
      <p>{startupOverlaySource.caption}</p>
    </>} />
}
