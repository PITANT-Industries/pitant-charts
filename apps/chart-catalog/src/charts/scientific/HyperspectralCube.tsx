import { useMemo, useState } from 'react'
import { HyperspectralImage } from './HyperspectralImage'
import type { SpatialSelection } from './HyperspectralImage'
import { HyperspectralSpectrum } from './HyperspectralSpectrum'
import { analyseHyperspectral, hyperPixel, hyperRegion, hyperSpectrum } from './hyperspectral-model'
import type { HyperMode, HyperSample, HyperspectralCubeData } from './hyperspectral-model'
import './scientific-figure.css'
import './hyperspectral-cube.css'

export type { HyperChannels, HyperMode, HyperPixel, HyperspectralCubeData } from './hyperspectral-model'

export interface HyperspectralCubeProps {
  data: HyperspectralCubeData
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Analysis = NonNullable<ReturnType<typeof analyseHyperspectral>>
const nm = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false })
const reading = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const channelNames = ['Red band', 'Green band', 'Blue band'] as const
const channels = [0, 1, 2] as const
const emptySamples: readonly HyperSample[] = []

function pixelLabel(start: number, end: number) {
  return start === end ? String(start) : `${start}–${end}`
}

function CubeFigure({ data, compact = false, label, source, analysis }: HyperspectralCubeProps & { analysis: Analysis; label: string }) {
  const [mode, setMode] = useState<HyperMode>('rgb')
  const [bandIndex, setBand] = useState(analysis.band)
  const [channelsIndex, setRgb] = useState(analysis.rgb)
  const [selection, setSelection] = useState<SpatialSelection>({ anchor: analysis.pixel, focus: analysis.pixel })
  const band = analysis.bands.includes(bandIndex) ? bandIndex : analysis.band
  const rgb = channelsIndex.every((channel) => analysis.bands.includes(channel)) ? channelsIndex : analysis.rgb
  const spatial = useMemo(() => ({
    anchor: hyperPixel(data, selection.anchor), focus: hyperPixel(data, selection.focus),
  }), [data, selection])
  const region = useMemo(() => hyperRegion(spatial.anchor, spatial.focus), [spatial])
  const samples = useMemo(() => compact ? emptySamples : hyperSpectrum(data, analysis.bands, region), [compact, data, analysis.bands, region])
  const selected = samples[band]
  const { x0, x1, y0, y1 } = region
  const span = (x1 - x0 + 1) * (y1 - y0 + 1)
  const wavelength = data.wavelengthsNm[band]
  const unit = data.valueUnit ?? ''
  const name = data.valueLabel ?? 'Spectral value'
  const valueAxis = unit ? `${name} (${unit})` : name
  const suffix = unit === '%' ? unit : unit ? ` ${unit}` : ''
  const stride = data.pixelStride ?? 1
  const columnOrigin = data.columnOrigin ?? 0
  const rowOrigin = data.rowOrigin ?? 0

  function selectBand(next: number) {
    setBand(next)
    setMode('band')
  }

  function selectChannel(channel: 0 | 1 | 2, next: number) {
    const updated: [number, number, number] = [...rgb]
    updated[channel] = next
    setRgb(updated)
  }

  return (
    <figure className="hyperspectral-cube" data-hyperspectral-cube="" data-compact={compact} aria-label={label}>
      <div className="hyper-panels">
        <div className="hyper-panel">
          {!compact && <div className="hyper-panel-title"><b>A</b> Spectral image</div>}
          <HyperspectralImage data={data} mode={mode} band={band} rgb={rgb} range={analysis.displayRange}
            selection={spatial} compact={compact} title={`${label}, selected spectral image`} choose={setSelection} />
          {!compact && <div className="hyper-controls">
            <label className="hyper-control">Image mode
              <select value={mode} onChange={(event) => setMode(event.currentTarget.value as HyperMode)}>
                <option value="rgb">RGB composite</option>
                <option value="band">Single band</option>
              </select>
            </label>
            {mode === 'rgb' && <div className="hyper-channels">
              {channels.map((channel) => <label className="hyper-control" key={channel}>{channelNames[channel]}
                <select aria-description="Wavelength in nanometers" value={rgb[channel]}
                  onChange={(event) => selectChannel(channel, Number(event.currentTarget.value))}>
                  {analysis.bands.map((index) => <option key={index} value={index}>{nm.format(data.wavelengthsNm[index])}</option>)}
                </select>
              </label>)}
            </div>}
          </div>}
        </div>
        {!compact && <div className="hyper-panel">
          <div className="hyper-panel-title"><b>B</b> {span === 1 ? 'Pixel spectrum' : 'Region spectrum'}</div>
          <HyperspectralSpectrum wavelengths={data.wavelengthsNm} samples={samples} bands={analysis.bands}
            band={band} range={analysis.displayRange} label={valueAxis} choose={selectBand} />
          <div className="hyper-spectrum-key">
            {span === 1 ? 'Selected pixel' : <>Region mean <span aria-hidden="true">·</span> Shading ±1 spatial SD</>}
          </div>
          <div className="hyper-controls">
            <label className="hyper-band-control">
              <span>Wavelength band</span><span aria-hidden="true">{nm.format(wavelength)} nm</span>
              <input type="range" min={0} max={analysis.bands.length - 1} step={1} value={analysis.bands.indexOf(band)}
                aria-label="Wavelength band" aria-valuetext={`${nm.format(wavelength)} nanometers`}
                onChange={(event) => selectBand(analysis.bands[event.currentTarget.valueAsNumber])} />
            </label>
          </div>
        </div>}
      </div>
      {!compact && <>
        <output className="hyper-readout" data-hyper-readout="" data-mode={mode} data-band={band} data-wavelength={wavelength}
          data-x0={x0} data-x1={x1} data-y0={y0} data-y1={y1} data-mean={selected?.mean} data-sd={selected?.sd} data-count={selected?.count ?? 0}>
          <span>Source column <strong>{pixelLabel(columnOrigin + x0 * stride, columnOrigin + x1 * stride)}</strong></span>
          <span>Source row <strong>{pixelLabel(rowOrigin + y0 * stride, rowOrigin + y1 * stride)}</strong></span>
          <span>Valid pixels <strong>{reading.format(selected?.count ?? 0)} / {reading.format(span)}</strong></span>
          <span>{span > 1 ? 'Band mean' : name} <strong>{selected ? `${reading.format(selected.mean)}${suffix}` : 'No data'}</strong></span>
          {selected && span > 1 && <span>Spatial SD <strong>{reading.format(selected.sd)}{suffix}</strong></span>}
        </output>
        <figcaption className="hyper-caption">
          <p>Image levels use a fixed {reading.format(analysis.displayRange[0])}{suffix}–{reading.format(analysis.displayRange[1])}{suffix} display range.</p>
          {source && <p>
            <a href={source.href}>{source.label}</a>
            {source.license && (source.licenseUrl ? <> · <a href={source.licenseUrl}>{source.license}</a></> : ` · ${source.license}`)}
            {source.description && <> · {source.description}</>}
          </p>}
        </figcaption>
      </>}
    </figure>
  )
}

export function HyperspectralCube({ data, label = 'Hyperspectral image cube', ...props }: HyperspectralCubeProps) {
  const analysis = useMemo(() => analyseHyperspectral(data), [data])
  if (!analysis) return <p className="chart-render-message" role="status">Provide a calibrated image cube with ordered wavelengths and at least two usable bands.</p>
  return <CubeFigure data={data} analysis={analysis} label={label} {...props} />
}
