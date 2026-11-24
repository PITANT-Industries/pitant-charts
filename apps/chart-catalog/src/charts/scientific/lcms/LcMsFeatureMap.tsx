import { useMemo, useState } from 'react'
import { FeatureFootprints, FeatureOverview, IonChromatogram, featureViewport } from './LcMsPlots'
import { nearestLcMsSampleIndex, prepareLcMsFeatures } from './model'
import type { LcMsFeatureData, PreparedLcMsFeature, PreparedLcMsTrace } from './model'
import '../scientific-figure.css'
import './lcms-feature-map.css'

export interface LcMsFeatureMapProps {
  data: LcMsFeatureData
  initialFeature?: string
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; references?: readonly { label: string; href: string }[] }
}

type PreparedMap = NonNullable<ReturnType<typeof prepareLcMsFeatures>>
type Selection = { feature?: string; trace?: string; scan?: string }

const axisNumber = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 9 })
const timeNumber = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 })
const rawIntensity = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 11 })
const intensityLabel = (value: number | null) => value === null ? 'Unavailable' : rawIntensity.format(value)

function defaultTrace(feature: PreparedLcMsFeature): PreparedLcMsTrace | undefined {
  const withSamples = feature.traces.filter((trace) => trace.samples?.length)
  const choices = withSamples.length ? withSamples : feature.traces
  return choices.reduce<PreparedLcMsTrace | undefined>((nearest, trace) => (
    !nearest || Math.abs(trace.mz - feature.mz) < Math.abs(nearest.mz - feature.mz) ? trace : nearest
  ), undefined)
}

function FeatureMapFigure({ label, initialFeature, compact = false, source, prepared }:
  Omit<LcMsFeatureMapProps, 'data'> & { label: string; prepared: PreparedMap }) {
  const [selection, setSelection] = useState<Selection>({})
  const { features, byId, bounds } = prepared
  const defaultFeature = useMemo(() => features.reduce((highest, feature) => (
    feature.intensity > highest.intensity ? feature : highest
  )), [features])
  const feature = byId.get(selection.feature ?? initialFeature ?? '') ?? defaultFeature
  const trace = feature.traces.find(({ id }) => id === selection.trace) ?? defaultTrace(feature)
  const viewport = useMemo(() => featureViewport(feature), [feature])
  const samples = trace?.samples ?? []
  const pickedIndex = samples.findIndex(([id]) => id === selection.scan)
  const scanIndex = pickedIndex < 0 ? (nearestLcMsSampleIndex(samples, feature.rtSeconds) ?? 0) : pickedIndex
  const scan = samples[scanIndex]

  function pickTrace(id: string) {
    setSelection({ feature: feature.id, trace: id, scan: scan?.[0] })
  }

  function pickScan(index: number) {
    setSelection({ feature: feature.id, trace: trace?.id, scan: samples[index]?.[0] })
  }

  return <figure className="lcms-feature-map" aria-label={label} data-lcms-map data-compact={compact}>
    {!compact && <>
      <FeatureOverview features={features} selected={feature} bounds={bounds} maximum={defaultFeature.intensity}
        onSelect={(id) => setSelection({ feature: id })} />
      <div className="lcms-controls">
        <label>Detected feature
          <select value={feature.id} onChange={(event) => setSelection({ feature: event.currentTarget.value })}>
            {features.map((item) => <option key={item.id} value={item.id}>
              {axisNumber.format(item.mz)} m/z · {timeNumber.format(item.rtSeconds / 60)} min
            </option>)}
          </select>
        </label>
        {feature.traces.length > 1 && <label>Ion trace
          <select value={trace?.id} onChange={(event) => pickTrace(event.currentTarget.value)}>
            {feature.traces.map((item) => <option key={item.id} value={item.id}>{axisNumber.format(item.mz)} m/z</option>)}
          </select>
        </label>}
      </div>
      <output className="lcms-feature-summary" data-lcms-feature-summary={feature.id} data-feature-rt={feature.rtSeconds}
        data-feature-mz={feature.mz} data-feature-intensity={feature.intensity} data-feature-charge={feature.charge ?? undefined}
        data-feature-traces={feature.traces.length}>
        <span>Feature <strong>{feature.id}</strong></span>
        <span>Charge <strong>{feature.charge ? (feature.charge > 0 ? `+${feature.charge}` : feature.charge) : '—'}</strong></span>
        <span>Feature intensity <strong>{rawIntensity.format(feature.intensity)}</strong></span>
        <span>Mass traces <strong>{feature.traces.length}</strong></span>
      </output>
    </>}
    <div className="lcms-linked">
      <div className="lcms-footprint-panels">
        {!compact && <section aria-label="Calibrated mass-trace footprints">
          <h3>Mass-trace footprints</h3>
          <FeatureFootprints feature={feature} trace={trace} viewport={viewport} scanTime={scan?.[1]} compact={false} onSelect={pickTrace} />
        </section>}
        {(trace || compact) && <section aria-label="Selected mass-trace detail">
          {!compact && trace && <h3>Selected trace <span className="lcms-trace-reference">{axisNumber.format(trace.mz)} m/z</span></h3>}
          <FeatureFootprints feature={feature} trace={trace} viewport={viewport} scanTime={compact ? undefined : scan?.[1]}
            compact={compact} detail onSelect={pickTrace} />
        </section>}
      </div>
      {trace && samples.length > 0 ? <section aria-label="Selected ion chromatogram">
        {!compact && <h3>Extracted-ion chromatogram</h3>}
        <IonChromatogram trace={trace} viewport={viewport} scanIndex={scanIndex} compact={compact} onInspect={pickScan} />
        {!compact && scan && <div className="lcms-scan-inspector">
          {samples.length > 1 && <label className="lcms-scan-control">Scan
            <input type="range" min={0} max={samples.length - 1} step={1} value={scanIndex}
              aria-valuetext={`${scan[0]}, ${timeNumber.format(scan[1])} seconds, ${intensityLabel(scan[2])}`}
              onChange={(event) => pickScan(event.currentTarget.valueAsNumber)} />
            <span aria-hidden="true">{scanIndex + 1} / {samples.length}</span>
          </label>}
          <output className="lcms-scan-evidence" data-lcms-scan-evidence={scan[0]} data-scan-rt={scan[1]}
            data-scan-intensity={scan[2] ?? undefined} data-scan-state={scan[2] === null ? 'missing' : 'measured'}
            data-trace={trace.id} data-mz-min={trace.mzWindow?.[0]} data-mz-max={trace.mzWindow?.[1]}>
            <span>Source scan <strong>{scan[0]}</strong></span>
            <span>Retention time <strong>{timeNumber.format(scan[1])} s</strong></span>
            <span>Ion intensity <strong>{intensityLabel(scan[2])}</strong></span>
            {trace.mzWindow && <span>Extraction window <strong>{axisNumber.format(trace.mzWindow[0])}–{axisNumber.format(trace.mzWindow[1])} m/z</strong></span>}
          </output>
        </div>}
      </section> : !compact && <p className="lcms-no-samples" role="status">This ion trace has no per-scan intensity series.</p>}
    </div>
    {!compact && source && <figcaption className="lcms-caption">
      <div>
        <a href={source.href}>{source.label}</a>
        {source.references?.map(({ label, href }) => <span key={href}> · <a href={href}>{label}</a></span>)}
      </div>
      {source.description && <p>{source.description}</p>}
    </figcaption>}
  </figure>
}

export function LcMsFeatureMap({ data, label = 'LC–MS feature map', ...props }: LcMsFeatureMapProps) {
  const prepared = useMemo(() => prepareLcMsFeatures(data), [data])
  if (!prepared) return <p className="chart-render-message" role="status">Supply detected LC–MS features with finite retention times and mass-to-charge ratios.</p>
  return <FeatureMapFigure {...props} label={label} prepared={prepared} />
}
