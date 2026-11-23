import { useEffect, useId, useState } from 'react'
import { usePlotSize } from '../usePlotSize'
import { cieXy } from './cie-chromaticity-model'
import type { ChromaticityPoint, ChromaticitySpace, CieSpectralSample } from './cie-chromaticity-model'

type PlotGamut = { hull: readonly ChromaticityPoint[]; white?: ChromaticityPoint }
const wavelengthLabels = [420, 460, 480, 490, 500, 510, 520, 540, 560, 580, 600, 620]
const smallWavelengthLabels = [460, 490, 510, 540, 580, 620]
const format = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 1 })

function srgb(linear: number) {
  const value = Math.max(0, linear)
  return value <= .0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - .055
}

function colorField(space: ChromaticitySpace, xmax: number, ymax: number) {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = Math.round(canvas.width * ymax / xmax)
  const context = canvas.getContext('2d')
  if (!context) return undefined
  const frame = context.createImageData(canvas.width, canvas.height)
  let offset = 0
  for (let row = 0; row < canvas.height; row++) {
    const b = (1 - (row + .5) / canvas.height) * ymax
    for (let column = 0; column < canvas.width; column++) {
      const a = (column + .5) / canvas.width * xmax
      const [x, y] = space === 'xy' ? [a, b] : cieXy([a, b])
      const z = 1 - x - y
      // Chromaticity fixes the XYZ ratios. Normalize linear sRGB for a display illustration.
      const r = 3.24097 * x - 1.53738 * y - .49861 * z
      const g = -.96924 * x + 1.87597 * y + .04156 * z
      const blue = .05563 * x - .20398 * y + 1.05697 * z
      const peak = Math.max(r, g, blue, 1e-6)
      frame.data[offset++] = (srgb(r / peak) * .86 + .14) * 255
      frame.data[offset++] = (srgb(g / peak) * .86 + .14) * 255
      frame.data[offset++] = (srgb(blue / peak) * .86 + .14) * 255
      frame.data[offset++] = 255
    }
  }
  context.putImageData(frame, 0, 0)
  return canvas.toDataURL('image/png')
}

function axisTicks(maximum: number, pixels: number) {
  const step = pixels >= 215 ? .1 : .2
  return Array.from({ length: Math.floor(maximum / step + 1e-9) + 1 }, (_, index) => index * step)
}

export function CieChromaticityPlot({ space, domain, spectral, wavelengths, reference, comparison, overlap, marker, selectedXy, compact, choose }: {
  space: ChromaticitySpace
  domain: ChromaticityPoint
  spectral: readonly ChromaticityPoint[]
  wavelengths: readonly CieSpectralSample[]
  reference: PlotGamut
  comparison: PlotGamut
  overlap: readonly ChromaticityPoint[]
  marker: ChromaticityPoint
  selectedXy: ChromaticityPoint
  compact: boolean
  choose: (point: ChromaticityPoint) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 430 : 494, compact ? 215 : 441)
  const clip = useId()
  const hatching = useId()
  const [xmax, ymax] = domain
  const [field, setField] = useState<{ space: ChromaticitySpace; xmax: number; ymax: number; href: string | undefined }>()
  useEffect(() => {
    setField({ space, xmax, ymax, href: colorField(space, xmax, ymax) })
  }, [space, xmax, ymax])
  const href = field?.space === space && field.xmax === xmax && field.ymax === ymax ? field.href : undefined
  const margin = compact ? { left: 34, right: 20, top: 13, bottom: 36 } : { left: 46, right: 36, top: 25, bottom: 43 }
  const availableWidth = Math.max(1, width - margin.left - margin.right)
  const availableHeight = Math.max(1, height - margin.top - margin.bottom)
  const scale = Math.min(availableWidth / xmax, availableHeight / ymax)
  const plotWidth = xmax * scale
  const plotHeight = ymax * scale
  const left = margin.left + (availableWidth - plotWidth) / 2
  const top = margin.top + (availableHeight - plotHeight) / 2
  const bottom = top + plotHeight
  const x = (value: number) => left + value * scale
  const y = (value: number) => bottom - value * scale
  const pixel = ([a, b]: ChromaticityPoint) => `${x(a)},${y(b)}`
  const locus = `M${spectral.map(pixel).join('L')}`
  const [axisX, axisY] = space === 'xy' ? ['x', 'y'] : ['u′', 'v′']
  const labels = width < 350 || compact ? smallWavelengthLabels : wavelengthLabels.filter((wavelength) => space === 'uv' || wavelength !== 420)
  const white = reference.white
  const oppositeWhite = comparison.white
  const sharedWhite = white && oppositeWhite && white.every((value, index) => Math.abs(value - oppositeWhite[index]) < 1e-8)
  const whites = sharedWhite ? [white] : [white, oppositeWhite]
  const intersection = overlap.length >= 3

  return (
    <div className="cie-plot scientific-plot" ref={plot}>
      <svg data-cie-diagram="" data-space={space} viewBox={`0 0 ${width} ${height}`}
        role={compact ? 'img' : 'group'} aria-label={`CIE ${space === 'xy' ? '1931 xy' : '1976 u prime v prime'} chromaticity diagram`}>
        <defs>
          <clipPath id={clip}><path d={`${locus}Z`} /></clipPath>
          <pattern id={hatching} width="5" height="5" patternUnits="userSpaceOnUse">
            <path d="M-1,1 1,-1 M0,5 5,0 M4,6 6,4" stroke="#223448" strokeWidth=".65" strokeOpacity=".42" />
          </pattern>
        </defs>
        {href && <image data-cie-field="" x={left} y={top} width={plotWidth} height={plotHeight}
          href={href} preserveAspectRatio="none" clipPath={`url(#${clip})`} />}
        <g className="scientific-axis" aria-hidden="true">
          {axisTicks(xmax, plotWidth).map((value) => <g key={value}>
            <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 5} />
            <text x={x(value)} y={bottom + 17} textAnchor="middle">{format.format(value)}</text>
          </g>)}
          {axisTicks(ymax, plotHeight).map((value) => <g key={value}>
            <line className="scientific-tick" x1={left} x2={left - 5} y1={y(value)} y2={y(value)} />
            <text x={left - 8} y={y(value) + 4} textAnchor="end">{format.format(value)}</text>
          </g>)}
          <text className="cie-axis-name" x={left + plotWidth / 2} y={bottom + 31} textAnchor="middle">{axisX}</text>
          <text className="cie-axis-name" x={left - 29} y={top + plotHeight / 2 + 4} textAnchor="middle">{axisY}</text>
        </g>
        <rect data-cie-frame="" data-x-max={xmax} data-y-max={ymax}
          className="scientific-frame" x={left} y={top} width={plotWidth} height={plotHeight} />
        <path className="cie-spectral-boundary" data-cie-spectral-locus="" d={locus} />
        <path className="cie-purple-boundary" data-cie-purple-line="" d={`M${pixel(spectral[0])}L${pixel(spectral[spectral.length - 1])}`} />
        {intersection && <polygon data-cie-overlap="" points={overlap.map(pixel).join(' ')} fill={`url(#${hatching})`} />}
        <polygon className="cie-gamut-outline" data-cie-gamut="comparison" points={comparison.hull.map(pixel).join(' ')} />
        <polygon className="cie-gamut-outline" data-cie-gamut="reference" points={reference.hull.map(pixel).join(' ')} />
        {whites.map((point, index) => point && <path data-cie-white="" key={index}
          d={`M${x(point[0])},${y(point[1]) - 4}l4,4 -4,4 -4,-4z`} />)}
        <g className="cie-wavelengths" aria-hidden="true">
          {labels.map((wavelength) => {
            const index = wavelengths.findIndex(({ wavelengthNm }) => wavelengthNm === wavelength)
            if (index < 0) return null
            const [a, b] = spectral[index]
            const before = spectral[Math.max(0, index - 1)]
            const after = spectral[Math.min(spectral.length - 1, index + 1)]
            const da = before[1] - after[1]
            const db = after[0] - before[0]
            const length = Math.hypot(da, db)
            if (!length) return null
            const dx = da / length
            const dy = -db / length
            const xx = x(a)
            const yy = y(b)
            const anchor = dx > .28 ? 'start' : dx < -.28 ? 'end' : 'middle'
            const labelX = xx + dx * 7
            const flip = labelX < left + 20 && anchor !== 'start'
            const labelY = Math.max(top + 11, Math.min(bottom - 5, yy + dy * 8 + 3))
            return <g key={wavelength}>
              <line x1={xx} y1={yy} x2={xx + dx * 4} y2={yy + dy * 4} />
              <text x={flip ? xx + 5 : labelX} y={labelY} textAnchor={flip ? 'start' : anchor}>{wavelength}</text>
            </g>
          })}
        </g>
        {!compact && <>
          <circle data-cie-selected="" data-x={selectedXy[0]} data-y={selectedXy[1]}
            cx={x(marker[0])} cy={y(marker[1])} r="5" />
          <rect data-cie-pick="" x={left} y={top} width={plotWidth} height={plotHeight} fill="transparent"
            tabIndex={0} role="group" aria-label="Select a chromaticity with the arrow keys"
            aria-keyshortcuts="ArrowLeft ArrowRight ArrowUp ArrowDown"
            onClick={(event) => {
              const svg = event.currentTarget.ownerSVGElement
              const ctm = svg?.getScreenCTM()
              if (!svg || !ctm) return
              const point = svg.createSVGPoint()
              point.x = event.clientX
              point.y = event.clientY
              const { x: xx, y: yy } = point.matrixTransform(ctm.inverse())
              choose([(xx - left) / scale, (bottom - yy) / scale])
            }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? .025 : .005
              const [a, b] = marker
              switch (event.key) {
                case 'ArrowLeft': choose([a - step, b]); break
                case 'ArrowRight': choose([a + step, b]); break
                case 'ArrowUp': choose([a, b + step]); break
                case 'ArrowDown': choose([a, b - step]); break
                default: return
              }
              event.preventDefault()
            }} />
        </>}
      </svg>
    </div>
  )
}
