import { useEffect, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { usePlotSize } from '../usePlotSize'
import { IndustrialCtVolume } from './IndustrialCtVolume'
import { analyseCt, ctAxes, ctClampVoxel, ctIndex, ctMillimeters, ctPlanes } from './industrial-ct-model'
import type { CtAxis, CtCoordinate, CtPlane, IndustrialCtData } from './industrial-ct-model'
import './scientific-figure.css'
import './industrial-ct.css'

export type { CtCoordinate, IndustrialCtData } from './industrial-ct-model'

export interface IndustrialCtViewerProps {
  data: IndustrialCtData
  label?: string
  compact?: boolean
  initialPoreId?: number
  source?: { label: string; href: string; description?: string; license?: string; licenseUrl?: string }
}

const axes = [0, 1, 2] as const
const planes = ['xy', 'xz', 'yz'] as const
const millimeters = new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 })
const axisFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const poreVolume = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4 })
const fractionFormat = new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits: 3 })

function scanImage(data: IndustrialCtData, plane: CtPlane, slice: number, mask: boolean, selected: number) {
  const { horizontal, vertical, fixed } = ctPlanes[plane]
  const width = data.dimensions[horizontal]
  const height = data.dimensions[vertical]
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return undefined
  const image = context.createImageData(width, height)
  const voxel: [number, number, number] = [0, 0, 0]
  voxel[fixed] = slice
  let offset = 0
  for (let row = 0; row < height; row++) {
    voxel[vertical] = height - 1 - row
    for (let column = 0; column < width; column++) {
      voxel[horizontal] = column
      const index = ctIndex(voxel, data.dimensions)
      const gray = data.gray[index]
      const pore = mask ? data.labels[index] : 0
      if (pore) {
        const [r, g, b] = pore === selected ? [217, 104, 57] : [69, 154, 194]
        image.data[offset] = gray * .25 + r * .75
        image.data[offset + 1] = gray * .25 + g * .75
        image.data[offset + 2] = gray * .25 + b * .75
      } else {
        image.data[offset] = gray
        image.data[offset + 1] = gray
        image.data[offset + 2] = gray
      }
      image.data[offset + 3] = 255
      offset += 4
    }
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

function axisIndices(count: number, dimension: number) {
  const segments = Math.max(1, Math.min(4, Math.floor(dimension / 47)))
  return [...new Set(Array.from({ length: segments + 1 }, (_, index) => Math.round(index / segments * (count - 1))))]
}

function CtSlice({ data, plane, voxel, selected, mask, compact, label, choose }: {
  data: IndustrialCtData
  plane: CtPlane
  voxel: CtCoordinate
  selected: number
  mask: boolean
  compact: boolean
  label: string
  choose: (voxel: CtCoordinate) => void
}) {
  const { fixed, horizontal, vertical, label: planeName } = ctPlanes[plane]
  const index = voxel[fixed]
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 430 : 368, compact ? 178 : 280)
  const [raster, setRaster] = useState<{ data: IndustrialCtData; index: number; mask: boolean; selected: number; href?: string }>()
  useEffect(() => {
    setRaster({ data, index, mask, selected, href: scanImage(data, plane, index, mask, selected) })
  }, [data, plane, index, mask, selected])
  const xCount = data.dimensions[horizontal]
  const yCount = data.dimensions[vertical]
  const physicalWidth = xCount * data.spacingUm[horizontal]
  const physicalHeight = yCount * data.spacingUm[vertical]
  const availableWidth = Math.max(1, width - (width < 350 ? 74 : 83))
  const availableHeight = Math.max(1, height - (compact ? 51 : 68))
  const scale = Math.min(availableWidth / physicalWidth, availableHeight / physicalHeight)
  const plotWidth = physicalWidth * scale
  const plotHeight = physicalHeight * scale
  const left = 49 + (availableWidth - plotWidth) / 2
  const right = left + plotWidth
  const bottom = height - 40
  const top = bottom - plotHeight
  const x = (sample: number) => left + (sample + .5) / xCount * plotWidth
  const y = (sample: number) => bottom - (sample + .5) / yCount * plotHeight
  const xLabel = `${ctAxes[horizontal]} (mm)`
  const yLabel = `${ctAxes[vertical]} (mm)`

  function pick(event: MouseEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const point: [number, number, number] = [...voxel]
    point[horizontal] = Math.floor((event.clientX - rect.left) / rect.width * xCount)
    point[vertical] = yCount - 1 - Math.floor((event.clientY - rect.top) / rect.height * yCount)
    choose(ctClampVoxel(point, data.dimensions))
  }

  const display = raster?.data === data && raster.index === index && raster.mask === mask && raster.selected === selected && raster.href
  return (
    <div className="ct-slice-panel scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" data-ct-slice="" data-plane={plane} data-slice-index={index}
        aria-label={`${label}. ${planeName} at ${ctAxes[fixed]} ${millimeters.format(ctMillimeters(index, fixed, data))} mm.`}>
        {display && <image data-ct-raster="" href={display} x={left} y={top} width={plotWidth} height={plotHeight}
          preserveAspectRatio="none" aria-hidden="true" />}
        <g className="scientific-axis" aria-hidden="true">
          <rect className="scientific-frame" data-ct-slice-frame="" x={left} y={top} width={plotWidth} height={plotHeight} />
          {!compact && <text className="scientific-panel-title" x={left} y={top - 8}>{planeName}</text>}
          {axisIndices(xCount, plotWidth).map((sample) => (
            <g key={sample}>
              <line className="scientific-tick" x1={x(sample)} x2={x(sample)} y1={bottom} y2={bottom + 4} />
              <text x={x(sample)} y={bottom + 17} textAnchor="middle">{axisFormat.format(ctMillimeters(sample, horizontal, data))}</text>
            </g>
          ))}
          {axisIndices(yCount, plotHeight).map((sample) => (
            <g key={sample}>
              <line className="scientific-tick" x1={left - 4} x2={left} y1={y(sample)} y2={y(sample)} />
              <text x={left - 8} y={y(sample) + 4} textAnchor="end">{axisFormat.format(ctMillimeters(sample, vertical, data))}</text>
            </g>
          ))}
          <text className="scientific-axis-label" x={(left + right) / 2} y={height - 5} textAnchor="middle">{xLabel}</text>
          <text className="scientific-axis-label" transform={`translate(${left - 44} ${(top + bottom) / 2}) rotate(-90)`}
            textAnchor="middle">{yLabel}</text>
        </g>
        {!compact && (
          <>
            <g className="ct-crosshair" data-ct-crosshair="" aria-hidden="true">
              <line x1={x(voxel[horizontal])} x2={x(voxel[horizontal])} y1={top} y2={bottom} />
              <line x1={left} x2={right} y1={y(voxel[vertical])} y2={y(voxel[vertical])} />
              <circle cx={x(voxel[horizontal])} cy={y(voxel[vertical])} r={4} />
            </g>
            <rect className="ct-slice-pick" fill="transparent" x={left} y={top} width={plotWidth} height={plotHeight} onClick={pick} />
          </>
        )}
      </svg>
    </div>
  )
}

function ViewerFigure({ data, analysis, label, compact = false, initialPoreId, source }: IndustrialCtViewerProps & {
  analysis: NonNullable<ReturnType<typeof analyseCt>>
  label: string
}) {
  const start = analysis.pores.find(({ id }) => id === initialPoreId) ?? analysis.pores[0]
  const [selection, setSelection] = useState<CtCoordinate>(() => start?.representative ?? [
    Math.floor(data.dimensions[0] / 2), Math.floor(data.dimensions[1] / 2), Math.floor(data.dimensions[2] / 2),
  ])
  const [mask, setMask] = useState(true)
  const [angle, setAngle] = useState({ yaw: -.62, pitch: .43 })
  const voxel = ctClampVoxel(selection, data.dimensions)
  const index = ctIndex(voxel, data.dimensions)
  const selected = data.labels[index]
  const pore = analysis.pores.find(({ id }) => id === selected)
  const physical = axes.map((axis) => ctMillimeters(voxel[axis], axis, data))
  const labeledShare = analysis.pores.reduce((sum, candidate) => sum + candidate.voxels, 0) / data.labels.length
  const displayedPlanes = compact ? (['xy'] as const) : planes

  function pickPore(id: number) {
    const next = analysis.pores.find((pore) => pore.id === id)
    if (next) setSelection(next.representative)
  }

  function moveAxis(axis: CtAxis, value: number) {
    const next: [number, number, number] = [...voxel]
    next[axis] = value
    setSelection(next)
  }

  return (
    <figure className="industrial-ct" data-industrial-ct="" data-compact={compact}>
      <div className="ct-view-grid">
        {displayedPlanes.map((plane) => <CtSlice key={plane} data={data} plane={plane} voxel={voxel}
          selected={selected} mask={mask} compact={compact} label={label} choose={setSelection} />)}
        {!compact && <IndustrialCtVolume data={data} faces={analysis.faces} selected={pore?.id}
          angle={angle} rotate={setAngle} pick={pickPore} />}
      </div>
      {!compact && (
        <>
          {analysis.pores.length > 0 && (
            <ul className="ct-key" aria-label="Pore colors">
              <li>Selected pore</li>
              <li>Other labeled pores</li>
            </ul>
          )}
          <div className="ct-controls">
            {analysis.pores.length > 0 && (
              <label>Pore
                <select value={pore?.id ?? ''} onChange={(event) => pickPore(Number(event.currentTarget.value))}>
                  <option value="" disabled>Unlabeled voxel</option>
                  {analysis.pores.map(({ id }) => <option key={id} value={id}>Pore {id}</option>)}
                </select>
              </label>
            )}
            <label className="ct-mask-control">
              <input type="checkbox" checked={mask} onChange={(event) => setMask(event.currentTarget.checked)} />Show pore mask
            </label>
          </div>
          <div className="ct-coordinate-controls">
            {axes.map((axis) => (
              <label key={axis}>{ctAxes[axis]} slice
                <input type="range" min={0} max={data.dimensions[axis] - 1} step={1} value={voxel[axis]}
                  aria-valuetext={`${millimeters.format(physical[axis])} mm`}
                  onChange={(event) => moveAxis(axis, Number(event.currentTarget.value))} />
              </label>
            ))}
          </div>
          <output className="ct-readout" data-ct-readout="" data-x={voxel[0]} data-y={voxel[1]} data-z={voxel[2]}
            data-x-mm={physical[0]} data-y-mm={physical[1]} data-z-mm={physical[2]}
            data-pore={pore?.id} data-voxels={pore?.voxels} data-volume-mm3={pore?.volumeMm3} data-intensity={data.gray[index]}>
            {axes.map((axis) => <span key={axis}>{ctAxes[axis]} <strong>{millimeters.format(physical[axis])} mm</strong></span>)}
            <span>Display intensity <strong>{data.gray[index]} / 255</strong></span>
            <span>Pore <strong>{pore?.id ?? 'Unlabeled voxel'}</strong></span>
            {pore && <span>Segmented volume <strong>{poreVolume.format(pore.volumeMm3 * 1e9)} µm³</strong></span>}
            {pore && <span>Voxels <strong>{pore.voxels.toLocaleString('en-US')}</strong></span>}
            <span>Labeled voxel share <strong>{fractionFormat.format(labeledShare)}</strong></span>
          </output>
          {source && (
            <figcaption className="ct-caption">
              <a href={source.href}>{source.label}</a>
              {source.license && (source.licenseUrl ? <> · <a href={source.licenseUrl}>{source.license}</a></> : ` · ${source.license}`)}
              {source.description && <p>{source.description}</p>}
            </figcaption>
          )}
        </>
      )}
    </figure>
  )
}

export function IndustrialCtViewer({ data, label = 'Industrial CT porosity', ...props }: IndustrialCtViewerProps) {
  const analysis = useMemo(() => analyseCt(data), [data])
  if (!analysis) return <p className="chart-render-message" role="status">Provide matching reconstructed intensity and pore-label volumes with calibrated voxel spacing.</p>
  return <ViewerFigure {...props} data={data} analysis={analysis} label={label} />
}
