import { useMemo, useState } from 'react'
import { usePlotSize } from '../usePlotSize'
import { CadScanViewport } from './CadScanViewport'
import { analyseCadScan, cadAxes, cadColor, cadIndices, cadIntersections, cadSection } from './cad-scan-model'
import type { CadScanDeviationData, CadSegment } from './cad-scan-model'
import './scientific-figure.css'
import './cad-scan.css'

export type { CadAxis, CadCoordinate, CadNominalMesh, CadScanDeviationData, CadScanPoint, CadTriangle } from './cad-scan-model'

export interface CadScanDeviationProps {
  data: CadScanDeviationData
  label?: string
  compact?: boolean
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

type Scan = NonNullable<ReturnType<typeof analyseCadScan>>
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const integer = new Intl.NumberFormat('en-US')
const coordinate = (value: number) => decimal.format(value).replace('-', '−')
const signed = (value: number) => `${value > 0 ? '+' : ''}${coordinate(value)}`

function ticks([min, max]: readonly [number, number], count: number) {
  const rough = (max - min) / count
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = magnitude * ([1, 2, 2.5, 5, 10].find((value) => value * magnitude >= rough) ?? 10)
  const start = Math.ceil(min / step)
  const end = Math.floor(max / step)
  return Array.from({ length: end - start + 1 }, (_, index) => (start + index) * step)
}

function CadScanSection({ data, scan, position, points, selected, segments, pick }: {
  data: CadScanDeviationData
  scan: Scan
  position: number
  points: readonly number[]
  selected?: number
  segments: readonly CadSegment[]
  pick: (index: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(445, 259)
  const { horizontal, vertical } = cadSection[scan.sectionAxis]
  const [xmin, xmax] = scan.bounds[horizontal]
  const [ymin, ymax] = scan.bounds[vertical]
  const availableWidth = Math.max(1, width - 70)
  const availableHeight = Math.max(1, height - 58)
  const scale = Math.min(availableWidth / (xmax - xmin), availableHeight / (ymax - ymin))
  const plotWidth = (xmax - xmin) * scale
  const plotHeight = (ymax - ymin) * scale
  const left = 54 + (availableWidth - plotWidth) / 2
  const top = 14 + (availableHeight - plotHeight) / 2
  const bottom = top + plotHeight
  const x = (value: number) => left + (value - xmin) * scale
  const y = (value: number) => bottom - (value - ymin) * scale
  const xTicks = ticks([xmin, xmax], Math.max(2, Math.floor(plotWidth / 42)))
  const yTicks = ticks([ymin, ymax], Math.max(2, Math.floor(plotHeight / 33)))
  const axisTitle = `${cadAxes[horizontal]}${cadAxes[vertical]} section`

  return (
    <div className="cad-section scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} data-cad-section="" data-section-axis={scan.sectionAxis}
        data-section-position={position} role="group" aria-label={`${axisTitle} and measured points`}
        tabIndex={0} onKeyDown={(event) => {
          if (!points.length || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
          event.preventDefault()
          const current = selected === undefined ? -1 : points.indexOf(selected)
          const step = event.key === 'ArrowRight' ? 1 : -1
          const next = current < 0 ? (step > 0 ? 0 : points.length - 1) : (current + step + points.length) % points.length
          pick(points[next])
        }}>
        <rect data-cad-section-frame="" className="scientific-frame" x={left} y={top} width={plotWidth} height={plotHeight} />
        <g className="scientific-axis" aria-hidden="true">
          {xTicks.map((value) => <g key={value}>
            <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 5} />
            <text x={x(value)} y={bottom + 18} textAnchor="middle">{coordinate(value)}</text>
          </g>)}
          {yTicks.map((value) => <g key={value}>
            <line className="scientific-tick" x1={left} x2={left - 5} y1={y(value)} y2={y(value)} />
            <text x={left - 8} y={y(value) + 4} textAnchor="end">{coordinate(value)}</text>
          </g>)}
          <text className="scientific-axis-label" x={left + plotWidth / 2} y={bottom + 35} textAnchor="middle">
            {cadAxes[horizontal]} (mm)
          </text>
          <text className="scientific-axis-label" transform={`translate(${left - 42} ${top + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle">{cadAxes[vertical]} (mm)</text>
        </g>
        {segments.length > 0 && <path data-cad-section-nominal="" className="cad-section-nominal" d={segments.map(([a, b]) =>
          `M${x(a[horizontal])},${y(a[vertical])}L${x(b[horizontal])},${y(b[vertical])}`).join(' ')} />}
        {points.map((index) => {
          const { point, deviationMm } = data.scan[index]
          if (index === selected) return null
          return <circle key={index} data-cad-section-point="" data-index={index} cx={x(point[horizontal])} cy={y(point[vertical])}
            r={3} fill={cadColor(deviationMm, scan.colorLimit)} onClick={() => pick(index)} />
        })}
        {selected !== undefined && points.includes(selected) &&
          <circle data-cad-section-point="" data-cad-section-selected="" data-index={selected}
            cx={x(data.scan[selected].point[horizontal])} cy={y(data.scan[selected].point[vertical])}
            r={4.5} fill={cadColor(data.scan[selected].deviationMm, scan.colorLimit)} onClick={() => pick(selected)} />}
      </svg>
    </div>
  )
}

function ScanFigure({ data, label, compact = false, source, scan }: CadScanDeviationProps & { label: string; scan: Scan }) {
  const { fixed } = cadSection[scan.sectionAxis]
  const [min, max] = scan.bounds[fixed]
  const [camera, setCamera] = useState({ yaw: -.56, pitch: .38 })
  const [selection, setSelection] = useState(scan.initial)
  const [section, setSection] = useState(data.scan[scan.initial].point[fixed])
  const [tolerance, setTolerance] = useState(String(scan.tolerance))
  const [outsideOnly, setOutsideOnly] = useState(false)
  const [nominal, setNominal] = useState(true)
  const threshold = tolerance === '' ? scan.tolerance : Number(tolerance)
  const { visible, outside } = useMemo(() => {
    let outside = 0
    const visible: number[] = []
    data.scan.forEach(({ deviationMm }, index) => {
      const beyond = Math.abs(deviationMm) > threshold
      if (beyond) outside++
      if (beyond || !outsideOnly) visible.push(index)
    })
    return { visible, outside }
  }, [data, threshold, outsideOnly])
  const selected = visible.includes(selection) ? selection : visible[0]
  const active = selected === undefined ? undefined : data.scan[selected]
  const sectionPosition = Math.max(min, Math.min(max,
    selected !== undefined && selected !== selection ? data.scan[selected].point[fixed] : section))
  const sectionPoints = useMemo(() => compact ? [] : visible.filter((index) =>
    Math.abs(data.scan[index].point[fixed] - sectionPosition) <= scan.halfSlab),
  [compact, visible, data, fixed, sectionPosition, scan.halfSlab])
  const segments = useMemo(() => compact ? [] : cadIntersections(data.nominal, fixed, sectionPosition),
    [compact, data.nominal, fixed, sectionPosition])

  function pick(index: number) {
    setSelection(index)
    setSection(data.scan[index].point[fixed])
  }

  function moveSection(value: number) {
    if (selected !== undefined) setSelection(selected)
    setSection(value)
  }

  return (
    <figure className="cad-scan" data-cad-scan="" data-compact={compact} aria-label={label}>
      {!compact && <div className="cad-scan-heading">
        <strong>A</strong><span>Registered surface</span>
      </div>}
      <CadScanViewport data={data} bounds={scan.bounds} camera={camera} visible={visible} selected={selected}
        nominal={nominal} limit={scan.colorLimit} section={segments} compact={compact} rotate={setCamera} pick={pick} />
      {!compact && <>
        <div className="cad-scan-controls cad-view-controls">
          <button type="button" onClick={() => setCamera(({ yaw, pitch }) => ({ yaw: yaw - .22, pitch }))}>Rotate left</button>
          <button type="button" onClick={() => setCamera(({ yaw, pitch }) => ({ yaw: yaw + .22, pitch }))}>Rotate right</button>
          <label className="cad-check"><input type="checkbox" checked={nominal} onChange={(event) => setNominal(event.currentTarget.checked)} />Show nominal surface</label>
        </div>
        <div className="cad-scan-detail">
          <div className="cad-scan-panel">
            <div className="cad-scan-heading">
              <strong>B</strong><span>{cadAxes[cadSection[scan.sectionAxis].horizontal]}{cadAxes[cadSection[scan.sectionAxis].vertical]} section</span>
              <span className="cad-nominal-key">Nominal boundary</span>
            </div>
            <CadScanSection data={data} scan={scan} position={sectionPosition} points={sectionPoints}
              selected={selected} segments={segments} pick={pick} />
            <label className="cad-section-control">
              <span>Section position</span>
              <span aria-hidden="true">{cadAxes[fixed]} = {coordinate(sectionPosition)} mm</span>
              <input type="range" min={min} max={max} step="any" value={sectionPosition} aria-label="Section position"
                aria-valuetext={`${cadAxes[fixed]} = ${coordinate(sectionPosition)} millimeters`}
                onChange={(event) => moveSection(event.currentTarget.valueAsNumber)} />
            </label>
            <p className="cad-section-note">Measured points within ±{coordinate(scan.halfSlab)} mm of the section.</p>
          </div>
          <div className="cad-scan-panel cad-inspection">
            <div className="cad-scan-heading"><span>Point inspection</span></div>
            <div className="cad-scan-controls">
              <label className="cad-tolerance">Tolerance (mm)
                <input type="number" min="0" step=".01" value={tolerance} onChange={(event) => {
                  const { value, valueAsNumber } = event.currentTarget
                  if (value === '' || (Number.isFinite(valueAsNumber) && valueAsNumber >= 0)) setTolerance(value)
                }} onBlur={() => { if (tolerance === '') setTolerance(String(scan.tolerance)) }} />
              </label>
              <label className="cad-check"><input type="checkbox" checked={outsideOnly}
                onChange={(event) => setOutsideOnly(event.currentTarget.checked)} />Outside tolerance only</label>
            </div>
            <output className="cad-scan-readout" data-cad-readout="" data-tolerance={threshold} data-outside-count={outside}
              data-visible-count={visible.length} data-index={selected} data-deviation-mm={active?.deviationMm}
              data-x={active?.point[0]} data-y={active?.point[1]} data-z={active?.point[2]}>
              <span className="cad-count"><strong>{integer.format(outside)} / {integer.format(data.scan.length)}</strong> outside ±{coordinate(threshold)} mm</span>
              {active ? <dl>
                <div><dt>Signed deviation</dt><dd>{signed(active.deviationMm)} mm</dd></div>
                <div><dt>Selected point</dt><dd>{Math.abs(active.deviationMm) > threshold ? 'Outside tolerance' : 'Within tolerance'}</dd></div>
                {cadIndices.map((axis) => <div key={axis}>
                  <dt>{cadAxes[axis]}</dt><dd>{coordinate(active.point[axis])} mm</dd>
                </div>)}
              </dl> : <span>No visible measurements</span>}
            </output>
          </div>
        </div>
        {source && <figcaption className="cad-scan-caption">
          <a href={source.href}>{source.label}</a>
          {source.license && (source.licenseUrl ? <> · <a href={source.licenseUrl}>{source.license}</a></> : ` · ${source.license}`)}
          {source.description && <p>{source.description}</p>}
        </figcaption>}
      </>}
    </figure>
  )
}

export function CadScanDeviation({ data, label = 'CAD–scan deviation', ...props }: CadScanDeviationProps) {
  const scan = useMemo(() => analyseCadScan(data), [data])
  if (!scan) return <p className="chart-render-message" role="status">Provide a nominal mesh and registered scan points with signed deviations in millimeters.</p>
  return <ScanFigure key={scan.sectionAxis} data={data} scan={scan} label={label} {...props} />
}
