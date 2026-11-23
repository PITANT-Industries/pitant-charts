import { usePlotSize } from '../usePlotSize'
import { hyperNearestBand } from './hyperspectral-model'
import type { HyperSample } from './hyperspectral-model'

const valueFormat = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 4, useGrouping: false })
const wavelengthFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: false })

function axisTicks(min: number, max: number, tickCount: number) {
  const rough = (max - min) / tickCount
  const exponent = 10 ** Math.floor(Math.log10(rough))
  const step = ([1, 2, 2.5, 5, 10].find((value) => value * exponent >= rough) ?? 10) * exponent
  const first = Math.ceil(min / step)
  const last = Math.floor(max / step)
  return Array.from({ length: last - first + 1 }, (_, index) => (first + index) * step)
}

function lineRuns(samples: readonly (HyperSample | undefined)[], minimumCount: number) {
  const runs: number[][] = []
  let run: number[] = []
  for (let band = 0; band < samples.length; band++) {
    const sample = samples[band]
    if ((sample?.count ?? 0) >= minimumCount) run.push(band)
    else if (run.length) {
      runs.push(run)
      run = []
    }
  }
  if (run.length) runs.push(run)
  return runs
}

export function HyperspectralSpectrum({ wavelengths, samples, bands, band, range, label, choose }: {
  wavelengths: readonly number[]
  samples: readonly (HyperSample | undefined)[]
  bands: readonly number[]
  band: number
  range: readonly [number, number]
  label: string
  choose: (band: number) => void
}) {
  const { plot, width, height } = usePlotSize<HTMLDivElement>(410, 316)
  const left = 57
  const top = 19
  const right = Math.max(left + 1, width - 20)
  const bottom = Math.max(top + 1, height - 44)
  const plotWidth = right - left
  const plotHeight = bottom - top
  const xmin = wavelengths[0]
  const xmax = wavelengths[wavelengths.length - 1]
  let [ymin, ymax] = range
  for (const sample of samples) {
    if (!sample) continue
    ymin = Math.min(ymin, sample.mean - sample.sd)
    ymax = Math.max(ymax, sample.mean + sample.sd)
  }
  const padding = (ymax - ymin) * .035
  ymin -= padding
  ymax += padding
  const x = (wavelength: number) => left + (wavelength - xmin) / (xmax - xmin) * plotWidth
  const y = (value: number) => bottom - (value - ymin) / (ymax - ymin) * plotHeight
  const point = (index: number, value: number) => `${x(wavelengths[index])},${y(value)}`
  const trace = lineRuns(samples, 1).map((run) => {
    const points = run.map((index) => point(index, samples[index]!.mean))
    return `M${points.join('L')}${points.length === 1 ? `L${points[0]}` : ''}`
  }).join(' ')
  const envelope = lineRuns(samples, 2).filter((run) => run.length >= 2).map((run) => {
    const upper = run.map((index) => point(index, samples[index]!.mean + samples[index]!.sd))
    const lower = [...run].reverse().map((index) => point(index, samples[index]!.mean - samples[index]!.sd))
    return `M${upper.concat(lower).join('L')}Z`
  }).join(' ')
  const wavelength = wavelengths[band]
  const active = samples[band]
  const offset = bands.indexOf(band)

  return (
    <div className="hyper-spectrum scientific-plot" ref={plot}>
      <svg viewBox={`0 0 ${width} ${height}`} data-hyper-spectrum="" data-band={band} data-wavelength={wavelength}
        data-wavelength-min={xmin} data-wavelength-max={xmax}
        role="group" aria-label={`${label} measured across wavelength`}>
        <rect className="scientific-frame" data-hyper-spectrum-frame="" x={left} y={top} width={plotWidth} height={plotHeight} />
        <g className="scientific-axis" aria-hidden="true">
          {axisTicks(xmin, xmax, Math.max(3, Math.floor(plotWidth / 44))).map((value) => <g key={value}>
            <line className="scientific-tick" x1={x(value)} x2={x(value)} y1={bottom} y2={bottom + 5} />
            <text x={x(value)} y={bottom + 18} textAnchor="middle">{wavelengthFormat.format(value)}</text>
          </g>)}
          {axisTicks(ymin, ymax, Math.max(3, Math.floor(plotHeight / 34))).map((value) => <g key={value}>
            <line className="scientific-tick" x1={left} x2={left - 5} y1={y(value)} y2={y(value)} />
            <text x={left - 8} y={y(value) + 4} textAnchor="end">{valueFormat.format(value)}</text>
          </g>)}
          <text className="scientific-axis-label" x={left + plotWidth / 2} y={bottom + 34} textAnchor="middle">Wavelength (nm)</text>
          <text className="scientific-axis-label" transform={`translate(${left - 43} ${top + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle">{label}</text>
        </g>
        {envelope && <path data-hyper-envelope="" d={envelope} />}
        {trace && <path data-hyper-trace="" d={trace} />}
        <line data-hyper-spectral-marker="" className="scientific-reference" x1={x(wavelength)} x2={x(wavelength)} y1={top} y2={bottom} />
        {active && <circle data-hyper-spectral-point="" cx={x(wavelength)} cy={y(active.mean)} r="3.2" />}
        {!trace && <text x={left + plotWidth / 2} y={top + plotHeight / 2} textAnchor="middle" className="scientific-axis"
          >No valid measurements in the selection</text>}
        <rect data-hyper-spectrum-pick="" x={left} y={top} width={plotWidth} height={plotHeight} fill="transparent"
          tabIndex={0} role="group" aria-label="Select a wavelength with the Left and Right arrow keys"
          aria-keyshortcuts="ArrowLeft ArrowRight Home End"
          onClick={(event) => {
            const svg = event.currentTarget.ownerSVGElement
            const ctm = svg?.getScreenCTM()
            if (!svg || !ctm) return
            const cursor = svg.createSVGPoint()
            cursor.x = event.clientX
            cursor.y = event.clientY
            const fraction = (cursor.matrixTransform(ctm.inverse()).x - left) / plotWidth
            choose(hyperNearestBand(wavelengths, bands, xmin + fraction * (xmax - xmin)))
          }}
          onKeyDown={(event) => {
            switch (event.key) {
              case 'ArrowLeft': choose(bands[Math.max(0, offset - 1)]); break
              case 'ArrowRight': choose(bands[Math.min(bands.length - 1, offset + 1)]); break
              case 'Home': choose(bands[0]); break
              case 'End': choose(bands[bands.length - 1]); break
              default: return
            }
            event.preventDefault()
          }} />
      </svg>
    </div>
  )
}
