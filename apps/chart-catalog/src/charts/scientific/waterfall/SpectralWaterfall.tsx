import { useId, useMemo, useState } from 'react'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs'
import type { SpectralAxis, SpectralSelection, SpectralWaterfallAxes, SpectralWaterfallData } from './model'
import { axisTitle, firstSelection, readIntensity } from './model'
import { SelectedSpectrum, SpectralHeatmap } from './SpectralViews'
import { WaterfallPlot } from './WaterfallPlot'
import './waterfall.css'

export interface SpectralWaterfallProps {
  data: SpectralWaterfallData
  axes: SpectralWaterfallAxes
  label?: string
  description?: string
  source?: { label: string; href: string }
  compact?: boolean
}

const measurementFormat = new Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 6,
  useGrouping: false,
})

function measuredValue(value: number, axis: SpectralAxis) {
  if (!Number.isFinite(value)) return 'Missing measurement'
  const magnitude = Math.abs(value)
  const formatted = magnitude >= 1e6 || magnitude > 0 && magnitude < 1e-4
    ? value.toExponential(5)
    : measurementFormat.format(value)
  if (!axis.unit) return formatted
  return `${formatted}${axis.unit === '°' ? '' : ' '}${axis.unit}`
}

export function SpectralWaterfall({
  data, axes, label = 'Spectral waterfall', description, source, compact = false,
}: SpectralWaterfallProps) {
  const initial = useMemo(() => firstSelection(data), [data])
  const [selection, setSelection] = useState<SpectralSelection>()
  const caption = useId()
  if (!initial) return <div className="chart-render-message" role="status">Supply ordered spectral positions and scans with matching intensity measurements.</div>

  const active = {
    scanIndex: Math.min(selection?.scanIndex ?? initial.scanIndex, data.scanValues.length - 1),
    binIndex: Math.min(selection?.binIndex ?? initial.binIndex, data.spectralBins.length - 1),
  }
  const plot = { data, axes, selection: active, onSelect: setSelection }
  const sourceVisible = Boolean(description || source)
  const scanValue = data.scanValues[active.scanIndex]
  const spectralValue = data.spectralBins[active.binIndex]
  const intensity = readIntensity(data, active)
  const grid = compact ? undefined : (
    <div className="waterfall-readout">
      <output data-spectral-measurement data-scan-index={active.scanIndex} data-bin-index={active.binIndex}
        data-intensity={Number.isFinite(intensity) ? String(intensity) : 'missing'}>
        <span><span>{axes.scan.label}</span><strong>{measuredValue(scanValue, axes.scan)}</strong></span>
        <span><span>{axes.spectral.label}</span><strong>{measuredValue(spectralValue, axes.spectral)}</strong></span>
        <span><span>{axes.intensity.label}</span><strong>{measuredValue(intensity, axes.intensity)}</strong></span>
      </output>
      <div className="waterfall-selection-controls" role="group" aria-label="Measurement selection">
        <label>
          <span>{axisTitle(axes.scan)}</span>
          <input type="range" min={0} max={data.scanValues.length - 1} value={active.scanIndex}
            aria-label="Scan" aria-valuetext={measuredValue(scanValue, axes.scan)}
            onChange={(event) => setSelection({ ...active, scanIndex: event.currentTarget.valueAsNumber })} />
        </label>
        <label>
          <span>{axisTitle(axes.spectral)}</span>
          <input type="range" min={0} max={data.spectralBins.length - 1} value={active.binIndex}
            aria-label="Spectral bin" aria-valuetext={measuredValue(spectralValue, axes.spectral)}
            onChange={(event) => setSelection({ ...active, binIndex: event.currentTarget.valueAsNumber })} />
        </label>
      </div>
    </div>
  )
  return (
    <figure className="spectral-waterfall" data-compact={compact} data-spectral-waterfall
      aria-label={label} aria-describedby={!compact && sourceVisible ? caption : undefined}>
      {compact ? <WaterfallPlot {...plot} compact /> : <>
        <Tabs defaultValue="waterfall" className="waterfall-tabs">
          <TabsList className="waterfall-view-toggle" aria-label="Spectral views">
            <TabsTab value="waterfall">3D Waterfall</TabsTab>
            <TabsTab value="heatmap">Heatmap</TabsTab>
            <TabsTab value="spectrum">Spectrum</TabsTab>
          </TabsList>
          <TabsPanel value="waterfall"><WaterfallPlot {...plot} /></TabsPanel>
          <TabsPanel value="heatmap"><SpectralHeatmap {...plot} /></TabsPanel>
          <TabsPanel value="spectrum"><SelectedSpectrum {...plot} /></TabsPanel>
        </Tabs>
        {grid}
        {sourceVisible && <figcaption id={caption}>
          {description}{source && <> <a href={source.href}>{source.label}</a></>}
        </figcaption>}
      </>}
    </figure>
  )
}
