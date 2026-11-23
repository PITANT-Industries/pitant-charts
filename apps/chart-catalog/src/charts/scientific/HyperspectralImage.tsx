import { useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { usePlotSize } from '../usePlotSize'
import { hyperPixel, hyperRegion, hyperValue } from './hyperspectral-model'
import type { HyperChannels, HyperMode, HyperPixel, HyperRegion, HyperspectralCubeData } from './hyperspectral-model'

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })
const wavelengthFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false })

function bandImage(data: HyperspectralCubeData, channels: HyperChannels, min: number, max: number) {
  const canvas = document.createElement('canvas')
  canvas.width = data.width
  canvas.height = data.height
  const context = canvas.getContext('2d')
  if (!context) return undefined
  const image = context.createImageData(data.width, data.height)
  const plane = data.width * data.height
  const [redOffset, greenOffset, blueOffset] = channels.map((band) => band * plane)
  const intensity = (value: number) => Math.max(0, Math.min(1, (value - min) / (max - min))) * 255
  for (let index = 0, offset = 0; index < plane; index++, offset += 4) {
    const red = hyperValue(data, redOffset + index)
    const green = greenOffset === redOffset ? red : hyperValue(data, greenOffset + index)
    const blue = blueOffset === redOffset ? red : blueOffset === greenOffset ? green : hyperValue(data, blueOffset + index)
    if (!Number.isFinite(red) || !Number.isFinite(green) || !Number.isFinite(blue)) continue
    image.data[offset] = intensity(red)
    image.data[offset + 1] = intensity(green)
    image.data[offset + 2] = intensity(blue)
    image.data[offset + 3] = 255
  }
  context.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}

function spatialTicks(count: number, pixels: number) {
  const segments = Math.max(1, Math.min(count - 1, Math.floor(pixels / 44), 5))
  return [...new Set(Array.from({ length: segments + 1 }, (_, index) => Math.round(index * (count - 1) / segments)))]
}

type SpatialSelection = { anchor: HyperPixel; focus: HyperPixel }
export type { SpatialSelection }

export function HyperspectralImage({ data, mode, band, rgb, range, selection, compact, title, choose }: {
  data: HyperspectralCubeData
  mode: HyperMode
  band: number
  rgb: HyperChannels
  range: readonly [number, number]
  selection: SpatialSelection
  compact: boolean
  title: string
  choose: (selection: SpatialSelection) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 410 : 460, compact ? 220 : 334)
  const level = useId()
  const gesture = useRef<{ pointerId: number; anchor: HyperPixel } | undefined>(undefined)
  const [draft, setDraft] = useState<HyperRegion>()
  const [red, green, blue] = mode === 'band' ? [band, band, band] : rgb
  const [min, max] = range
  const [raster, setRaster] = useState<string>()
  useEffect(() => setRaster(bandImage(data, [red, green, blue], min, max)), [data, red, green, blue, min, max])
  const margin = compact ? { left: 7, right: 7, top: 7, bottom: 7 } : { left: 57, right: 54, top: 12, bottom: 42 }
  const areaWidth = Math.max(1, width - margin.left - margin.right)
  const areaHeight = Math.max(1, height - margin.top - margin.bottom)
  const pixelSize = Math.min(areaWidth / data.width, areaHeight / data.height)
  const imageWidth = pixelSize * data.width
  const imageHeight = pixelSize * data.height
  const left = margin.left + (areaWidth - imageWidth) / 2
  const top = margin.top + (areaHeight - imageHeight) / 2
  const right = left + imageWidth
  const bottom = top + imageHeight
  const picked = draft ?? hyperRegion(selection.anchor, selection.focus)
  const sourceStride = data.pixelStride ?? 1
  const pointRegion = picked.x0 === picked.x1 && picked.y0 === picked.y1
  const selectionX = left + picked.x0 * pixelSize
  const selectionY = top + picked.y0 * pixelSize
  const selectionWidth = (picked.x1 - picked.x0 + 1) * pixelSize
  const selectionHeight = (picked.y1 - picked.y0 + 1) * pixelSize
  const rampY = top + 13
  const rampHeight = Math.max(1, imageHeight - 25)

  function pixelAt(event: PointerEvent<SVGRectElement>) {
    const svg = event.currentTarget.ownerSVGElement
    const transform = svg?.getScreenCTM()
    if (!svg || !transform) return undefined
    const point = svg.createSVGPoint()
    point.x = event.clientX
    point.y = event.clientY
    const { x, y } = point.matrixTransform(transform.inverse())
    return hyperPixel(data, [Math.floor((x - left) / pixelSize), Math.floor((y - top) / pixelSize)])
  }

  function cancelGesture(event: PointerEvent<SVGRectElement>) {
    if (gesture.current?.pointerId !== event.pointerId) return
    gesture.current = undefined
    setDraft(undefined)
  }

  return (
    <>
      <div className="hyper-image scientific-plot" ref={plot}>
        <svg viewBox={`0 0 ${width} ${height}`} role={compact ? 'img' : 'group'} aria-label={title}
          data-hyper-image="" data-mode={mode} data-width={data.width} data-height={data.height}
          data-band={band} data-red={rgb[0]} data-green={rgb[1]} data-blue={rgb[2]}>
          <defs><linearGradient id={level} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#000" /><stop offset="1" stopColor="#fff" />
          </linearGradient></defs>
          <rect className="hyper-missing-pixels" x={left} y={top} width={imageWidth} height={imageHeight} />
          {raster && <image data-hyper-raster="" href={raster} x={left} y={top} width={imageWidth} height={imageHeight} />}
          <rect data-hyper-image-frame="" className="scientific-frame" x={left} y={top} width={imageWidth} height={imageHeight} />
          {!compact && <>
            <g className="scientific-axis" aria-hidden="true">
              {spatialTicks(data.width, imageWidth).map((column) => {
                const x = left + (column + .5) * pixelSize
                return <g key={column}>
                  <line className="scientific-tick" x1={x} x2={x} y1={bottom} y2={bottom + 5} />
                  <text x={x} y={bottom + 17} textAnchor="middle">{(data.columnOrigin ?? 0) + column * sourceStride}</text>
                </g>
              })}
              {spatialTicks(data.height, imageHeight).map((row) => {
                const y = top + (row + .5) * pixelSize
                return <g key={row}>
                  <line className="scientific-tick" x1={left} x2={left - 5} y1={y} y2={y} />
                  <text x={left - 8} y={y + 4} textAnchor="end">{(data.rowOrigin ?? 0) + row * sourceStride}</text>
                </g>
              })}
              <text className="scientific-axis-label" x={left + imageWidth / 2} y={bottom + 34} textAnchor="middle">Source column</text>
              <text className="scientific-axis-label" transform={`translate(${left - 43} ${top + imageHeight / 2}) rotate(-90)`}
                textAnchor="middle">Source row</text>
            </g>
            {mode === 'band' && <g className="scientific-axis hyper-tone" data-hyper-colorbar="" data-min={min} data-max={max}>
              <text x={right + 10} y={top + 7}>{data.valueUnit || data.valueLabel || 'Value'}</text>
              <rect x={right + 10} y={rampY} width="10" height={rampHeight} fill={`url(#${level})`} />
              <rect className="scientific-frame" x={right + 10} y={rampY} width="10" height={rampHeight} />
              <text x={right + 24} y={rampY + 5}>{numberFormat.format(max)}</text>
              <text x={right + 24} y={rampY + rampHeight + 4}>{numberFormat.format(min)}</text>
            </g>}
            <rect data-hyper-region="" data-x0={picked.x0} data-x1={picked.x1} data-y0={picked.y0} data-y1={picked.y1}
              x={selectionX} y={selectionY} width={selectionWidth} height={selectionHeight} />
            {pointRegion && <path className="hyper-crosshair" d={
              `M${selectionX + selectionWidth / 2 - 5},${selectionY + selectionHeight / 2}h10` +
              `M${selectionX + selectionWidth / 2},${selectionY + selectionHeight / 2 - 5}v10`
            } />}
            <rect data-hyper-image-pick="" x={left} y={top} width={imageWidth} height={imageHeight} fill="transparent" tabIndex={0}
              role="group" aria-label="Select a pixel with the arrow keys. Hold Shift to extend the region."
              aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown Shift+ArrowLeft Shift+ArrowRight Shift+ArrowUp Shift+ArrowDown"
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0) return
                const pixel = pixelAt(event)
                if (!pixel) return
                gesture.current = { pointerId: event.pointerId, anchor: pixel }
                setDraft(hyperRegion(pixel, pixel))
                event.currentTarget.setPointerCapture(event.pointerId)
              }}
              onPointerMove={(event) => {
                const start = gesture.current
                if (start?.pointerId !== event.pointerId) return
                const pixel = pixelAt(event)
                if (pixel) setDraft(hyperRegion(start.anchor, pixel))
              }}
              onPointerUp={(event) => {
                const start = gesture.current
                if (start?.pointerId !== event.pointerId) return
                gesture.current = undefined
                setDraft(undefined)
                choose({ anchor: start.anchor, focus: pixelAt(event) ?? start.anchor })
              }}
              onPointerCancel={cancelGesture}
              onLostPointerCapture={cancelGesture}
              onKeyDown={(event) => {
                const [column, row] = selection.focus
                let position: HyperPixel
                switch (event.key) {
                  case 'ArrowLeft': position = [column - 1, row]; break
                  case 'ArrowRight': position = [column + 1, row]; break
                  case 'ArrowUp': position = [column, row - 1]; break
                  case 'ArrowDown': position = [column, row + 1]; break
                  default: return
                }
                event.preventDefault()
                const focus = hyperPixel(data, position)
                choose({ focus, anchor: event.shiftKey ? selection.anchor : focus })
              }} />
          </>}
        </svg>
      </div>
      {!compact && <div className="hyper-image-key">
        {mode === 'band' ? <span>{wavelengthFormat.format(data.wavelengthsNm[band])} nm · Single band</span> : <>
          <span data-hyper-channel="red">R {wavelengthFormat.format(data.wavelengthsNm[red])}</span>
          <span data-hyper-channel="green">G {wavelengthFormat.format(data.wavelengthsNm[green])}</span>
          <span data-hyper-channel="blue">B {wavelengthFormat.format(data.wavelengthsNm[blue])} nm</span>
        </>}
      </div>}
    </>
  )
}
