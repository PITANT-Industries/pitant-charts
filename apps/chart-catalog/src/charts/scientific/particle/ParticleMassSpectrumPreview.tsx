import { useId, useState } from 'react'
import type { MouseEvent } from 'react'
import type { ChartPreviewProps } from '../../../types'
import { usePlotSize } from '../../usePlotSize'
import histogram from './cms-dimuon-bins.json'
import './particle-mass-spectrum.css'

const { counts, eventCount, source, binning: { minimumGeV, maximumGeV } } = histogram
const massRatio = maximumGeV / minimumGeV
const peakIndex = counts.indexOf(Math.max(...counts))
const countDecades = Math.ceil(Math.log10(counts[peakIndex]))
const countsFormat = new Intl.NumberFormat('en-US')
const massFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 3 })

const resonances = [
  { label: 'J/ψ', compactLabel: 'J/ψ', mass: 3.097, lower: 2.98, upper: 3.24 },
  { label: 'Υ family', compactLabel: 'Υ', mass: 9.46, lower: 9.05, upper: 10.85 },
  { label: 'Z', compactLabel: 'Z', mass: 91.2, lower: 84, upper: 99 },
]

const n = (value: number) => Number(value.toFixed(2))
const massEdge = (index: number) => minimumGeV * massRatio ** (index / counts.length)

const resonancePeaks = resonances.flatMap(({ label, lower, upper }) => {
  let peak = -1
  for (const [index, count] of counts.entries()) {
    const center = massEdge(index + .5)
    if (center >= lower && center <= upper && (peak === -1 || count > counts[peak])) peak = index
  }
  return peak === -1 ? [] : [{ label, index: peak }]
})

function ParticleMassSpectrum({ compact }: { compact: boolean }) {
  const captionId = useId()
  const chartId = useId()
  const { plot, width, height } = usePlotSize<HTMLDivElement>(compact ? 320 : 680, compact ? 180 : 320)
  const [selectedIndex, setSelectedIndex] = useState(peakIndex)
  const narrow = width <= 440
  const left = narrow ? 33 : 47
  const right = Math.max(left + 1, width - 14)
  const top = compact ? 37 : 46
  const bottom = Math.max(top + 1, height - (compact ? 35 : 46))
  const plotWidth = right - left
  const plotHeight = bottom - top

  const x = (mass: number) => left + plotWidth * Math.log(mass / minimumGeV) / Math.log(massRatio)
  const xEdge = (index: number) => left + plotWidth * index / counts.length
  const y = (count: number) => bottom - plotHeight * Math.log10(count) / countDecades
  const massTicks = narrow ? [2, 5, 10, 20, 50, 110] : [2, 3, 5, 10, 20, 50, 110]
  const countTicks = Array.from({ length: countDecades + 1 }, (_, exponent) => 10 ** exponent)
  const contour = counts.map((count, index) =>
    `${index === 0 ? `M${n(left)} ${n(y(count))}` : `V${n(y(count))}`}H${n(xEdge(index + 1))}`,
  ).join('')
  const area = `${contour}V${n(bottom)}H${n(left)}Z`
  const range = `${massFormat.format(massEdge(selectedIndex))}–${massFormat.format(massEdge(selectedIndex + 1))} GeV`
  const selectedCount = countsFormat.format(counts[selectedIndex])

  function selectBin(event: MouseEvent<SVGSVGElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const clickedX = (event.clientX - rect.left) * width / rect.width
    const clickedY = (event.clientY - rect.top) * height / rect.height
    if (clickedX < left || clickedX > right || clickedY < top || clickedY > bottom) return
    setSelectedIndex(Math.min(counts.length - 1, Math.floor((clickedX - left) / plotWidth * counts.length)))
  }

  return (
    <figure className="particle-mass-spectrum" data-particle-mass-spectrum data-compact={compact}
      aria-describedby={compact ? undefined : captionId}>
      {!compact && (
        <figcaption id={captionId} className="particle-mass-caption">
          <strong>{source.title}</strong>
          <span>{countsFormat.format(eventCount)} recorded muon pairs across all source charge combinations.
            Shaded bands show reference resonance regions. <a href={source.url}>CERN Open Data (CC0)</a>
          </span>
        </figcaption>
      )}
      <div ref={plot} className="particle-mass-plot">
        <svg viewBox={`0 0 ${width} ${height}`} data-particle-plot
          role={compact ? undefined : 'img'} aria-hidden={compact || undefined}
          aria-labelledby={compact ? undefined : chartId}
          onClick={compact ? undefined : selectBin}>
          {!compact && <title id={chartId}>Dimuon mass histogram with logarithmic mass and event-count axes</title>}
          <defs>
            <linearGradient id={`${chartId}-fill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--particle-trace)" stopOpacity=".26" />
              <stop offset="1" stopColor="var(--particle-trace)" stopOpacity=".06" />
            </linearGradient>
          </defs>
          <g className="particle-mass-grid" aria-hidden="true">
            {countTicks.map(count => <line key={count} x1={left} x2={right} y1={y(count)} y2={y(count)} />)}
          </g>
          {resonances.map(({ label, compactLabel, mass, lower, upper }) => (
            <g className="particle-mass-resonance" key={label} data-particle-resonance={label} aria-hidden="true">
              <rect x={x(lower)} y={top} width={x(upper) - x(lower)} height={plotHeight} />
              <line x1={x(mass)} x2={x(mass)} y1={top - 4} y2={bottom} />
              <text x={x(mass)} y={top - 9} textAnchor="middle">{narrow || compact ? compactLabel : label}</text>
            </g>
          ))}
          <path d={area} fill={`url(#${chartId}-fill)`} />
          <path d={contour} className="particle-mass-trace" />
          <g className="particle-mass-axis" aria-hidden="true">
            <path d={`M${left} ${top}V${bottom}H${right}`} />
            {countTicks.map(count => (
              <text key={count} x={left - 6} y={y(count)} textAnchor="end" dominantBaseline="middle">
                {count < 1000 ? count : `${count / 1000}k`}
              </text>
            ))}
            {massTicks.map(mass => (
              <text key={mass} x={x(mass)} y={bottom + 15}
                textAnchor={mass === minimumGeV ? 'start' : mass === maximumGeV ? 'end' : 'middle'}>{mass}</text>
            ))}
            <text className="particle-mass-axis-title" x={left} y={12}>Events per bin (log)</text>
            <text className="particle-mass-axis-title" x={left + plotWidth / 2} y={height - 3} textAnchor="middle">
              {compact ? 'Mass (GeV, log)' : 'Dimuon invariant mass (GeV, log)'}
            </text>
          </g>
          {!compact && (
            <g aria-hidden="true" className="particle-mass-marker">
              <line x1={xEdge(selectedIndex + .5)} x2={xEdge(selectedIndex + .5)} y1={top} y2={bottom} />
              <circle cx={xEdge(selectedIndex + .5)} cy={y(counts[selectedIndex])} r={3.5} />
            </g>
          )}
        </svg>
      </div>
      {!compact && (
        <div className="particle-mass-inspector">
          <div className="particle-mass-selection">
            <output data-selected-particle-bin data-bin-index={selectedIndex} data-events={counts[selectedIndex]}>
              <span><span>Selected mass bin</span><strong>{range}</strong></span>
              <span><span>Events</span><strong>{selectedCount}</strong></span>
            </output>
            <div className="particle-mass-jumps" role="group" aria-label="Resonance regions">
              {resonancePeaks.map(({ label, index }) => (
                <button key={label} type="button" aria-label={`Select ${label} region`}
                  aria-pressed={selectedIndex === index} onClick={() => setSelectedIndex(index)}>{label}</button>
              ))}
            </div>
          </div>
          <label className="particle-mass-slider">
            <span>Explore mass bins</span>
            <input type="range" min={0} max={counts.length - 1} value={selectedIndex}
              aria-label="Invariant mass bin" aria-valuetext={`${range}, ${selectedCount} events`}
              onChange={(event) => setSelectedIndex(event.currentTarget.valueAsNumber)} />
          </label>
        </div>
      )}
    </figure>
  )
}

export default function ParticleMassSpectrumPreview({ compact = false, data }: ChartPreviewProps) {
  if (data !== undefined) {
    return <p className="chart-render-message" role="status">Omit custom data to view the published CMS example.</p>
  }
  return <ParticleMassSpectrum compact={compact} />
}
